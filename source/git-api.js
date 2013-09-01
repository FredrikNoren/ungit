var child_process = require('child_process');
var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var path = require('path');
var temp = require('temp');
var async=  require('async');
var git = require('./git');
var gerrit = require('./gerrit');
var gitParser = require('./git-parser');
var winston = require('winston');
var socketIO;
var watchr;


exports.pathPrefix = '';

exports.registerApi = function(app, server, ensureAuthenticated, config) {

	ensureAuthenticated = ensureAuthenticated || function(req, res, next) { next(); };

	app.use(express.bodyParser());

	var gitConfigCliPager = '-c core.pager=cat';

	var sockets = [];
	var io;

	if (server) {
		// To speed up loading times, we start this the next tick since it doesn't have to be instantly started with the server
		process.nextTick(function() {
			if (!socketIO) socketIO = require('socket.io');
			if (!watchr) watchr = require('watchr');
			io = socketIO.listen(server, {
				logger: {
					debug: winston.debug.bind(winston),
					info: winston.info.bind(winston),
					error: winston.error.bind(winston),
					warn: winston.warn.bind(winston)
				}
			});
			io.sockets.on('connection', function (socket) {
				sockets.push(socket);
				socket.emit('connected', { socketId: sockets.length - 1 });
				socket.on('disconnect', function () {
					if (socket.watchr) {
						socket.watchr.close();
						socket.watchr = null;
						winston.info('Stop watching ' + socket.watchrPath);
					}
				});
				socket.on('watch', function (data, callback) {
					if (socket.watchr) {
						socket.leave(socket.watchrPath);
						socket.watchr.close(); // only one watcher per socket
						winston.info('Stop watching ' + socket.watchrPath);
					}
					socket.join(path.normalize(data.path)); // join room for this path
					var watchOptions = {
						path: data.path,
						ignoreCommonPatterns: true,
						listener: function() {
							socket.emit('changed', { repository: data.path });
						},
						next: function(err, watchers) {
							callback();
						}
					};
					if (data.safeMode) watchOptions.preferredMethods = ['watchFile', 'watch'];
					socket.watchrPath = data.path;
					socket.watchr = watchr.watch(watchOptions);
					winston.info('Start watching ' + socket.watchrPath);
				});
			});
		});
	}

	var ensurePathExists = function(req, res, next) {
		var path = req.param('path');
		if (!fs.existsSync(path)) {
			res.json(400, { error: 'No such path: ' + path, errorCode: 'no-such-path' });
		} else {
			next();
		}
	}

	var emitRepoChanged = function(repoPath) {
		if (io) {
			io.sockets.in(path.normalize(repoPath)).emit('changed', { repository: repoPath });
			winston.info('emitting changed to sockets, manually triggered');
		}
	}

	var jsonResultOrFail = function(res, err, result) {
		if (err) res.json(400, err);
		else res.json(result);
	}

	var jsonResultOrFailAndTriggerChange = function(repoPath, res, err, result) {
		if (err) return res.json(400, err);
		res.json(result);
		emitRepoChanged(repoPath);
	}


	function credentialsOption(socketId) {
		var credentialsHelperPath = path.resolve(__dirname, '..', 'bin', 'credentials-helper').replace(/\\/g, '/');
		return '-c credential.helper="' + credentialsHelperPath + ' ' + socketId + '" ';
	}


	app.get(exports.pathPrefix + '/status', ensureAuthenticated, ensurePathExists, function(req, res) {
		git.status(req.param('path'), jsonResultOrFail.bind(null, res));
	});

	app.post(exports.pathPrefix + '/init', ensureAuthenticated, ensurePathExists, function(req, res) {
		git('init' + (req.body.bare ? ' --bare --shared' : ''), req.param('path'), undefined, jsonResultOrFail.bind(null, res));
	});

	app.post(exports.pathPrefix + '/clone', ensureAuthenticated, ensurePathExists, function(req, res) {
		var url = req.body.url.trim();
		if (url.indexOf('git clone ') == 0) url = url.slice('git clone '.length);
		git(credentialsOption(req.body.socketId) + ' clone "' + url + '" ' + '"' + req.body.destinationDir.trim() + '"', req.param('path'), undefined, jsonResultOrFail.bind(null, res));
	});

	app.post(exports.pathPrefix + '/fetch', ensureAuthenticated, ensurePathExists, function(req, res) {
		git('fetch ' + (req.body.ref ? 'origin ' + req.body.ref : ''), req.param('path'), undefined, function(err, text) {
			if (err) {
				if (err.stderr.indexOf('fatal: No remote repository specified.') == 0) {
					res.json({});
				} else if(err.stderr.indexOf('FATAL ERROR: Disconnected: No supported authentication methods available (server sent: publickey)') == 0) {
					err.errorCode = 'no-supported-authentication-provided';
					res.json(400, err);
				} else {
					res.json(400, err);
				}
			} else {
				res.json({});
				emitRepoChanged(req.param('path'));
			}
		});
	});

	app.post(exports.pathPrefix + '/push', ensureAuthenticated, ensurePathExists, function(req, res) {
		git(credentialsOption(req.body.socketId) + ' push origin ' + (req.body.localBranch ? req.body.localBranch : 'HEAD') +
			(req.body.remoteBranch ? ':' + req.body.remoteBranch : ''), req.param('path'), undefined, function(err, result) {
				if (err && err.stderr.indexOf('non-fast-forward') != -1) err.errorCode = 'non-fast-forward';
				jsonResultOrFailAndTriggerChange(req.param('path'), res, err, result);
			});
	});

	app.post(exports.pathPrefix + '/reset', ensureAuthenticated, ensurePathExists, function(req, res) {
		git.stashAndPop(req.param('path'), function(done) {
			git('reset --hard "' + req.body.to + '"', req.param('path'), undefined, done);
		}, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.get(exports.pathPrefix + '/diff', ensureAuthenticated, ensurePathExists, function(req, res) {
		var repoPath = req.param('path');
		git.status(repoPath, function(err, status) {
			if (err) return res.json(400, err);
			var file = status.files[req.query.file];
			if (!file) {
				if (fs.existsSync(path.join(repoPath, req.query.file))) res.json([]);
				else res.json(400, { error: 'No such file: ' + req.query.file, errorCode: 'no-such-file' });
			} else if (!file.isNew) {
				git(gitConfigCliPager + ' diff HEAD -- "' + req.query.file.trim() + '"', repoPath, gitParser.parseGitDiff, jsonResultOrFail.bind(null, res));
			} else {
				fs.readFile(path.join(repoPath, req.query.file), { encoding: 'utf8' }, function(err, text) {
					if (err) return res.json(400, { error: err });
					var diffs = [];
					var diff = { };
					text = text.toString();
					diff.lines = text.split('\n').map(function(line, i) { return [null, i, '+' + line]; });
					diffs.push(diff);
					res.json(diffs);
				});
			}
		});
	});

	app.post(exports.pathPrefix + '/discardchanges', ensureAuthenticated, ensurePathExists, function(req, res){
		if (req.body.all) {
			git('reset --hard HEAD', req.param('path'), null, function(err) {
				if (err) return res.json(400, err);
				git('clean -fd', req.param('path'), undefined, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
			});
		} else {
			git('checkout -- "' + req.body.file.trim() + '"', req.param('path'), null, function(err, text) {
				if (err) {
					if (err.stderr.trim() == 'error: pathspec \'' + req.body.file.trim() + '\' did not match any file(s) known to git.') {
						fs.unlink(path.join(req.param('path'), req.body.file), function(err) {
							if (err) res.json(400, { command: 'unlink', error: err });
							else {
								res.json({});
								emitRepoChanged(req.param('path'));
							}
						});
						return;
					}
					res.json(400, err);
					return;
				}
				
				res.json({});
				emitRepoChanged(req.param('path'));
			});
		}
	});

	app.post(exports.pathPrefix + '/commit', ensureAuthenticated, ensurePathExists, function(req, res){
		if (req.body.message === undefined)
			return res.json(400, { error: 'Must specify commit message' });
		if ((!(req.body.files instanceof Array) || req.body.files.length == 0) && !req.body.amend)
			return res.json(400, { error: 'Must specify files or amend to commit' });
		git.status(req.param('path'), function(err, status) {
			if (err) return res.json(400, err);
			var toAdd = [];
			var toRemove = [];
			for(var v in req.body.files) {
				var file = req.body.files[v];
				var fileStatus = status.files[file] || status.files[path.relative(req.param('path'), file)];
				if (!fileStatus) {
					res.json(400, { error: 'No such file in staging: ' + file });
					return;
				}
				if (fileStatus.removed) toRemove.push(file);
				else toAdd.push(file);
			}

			async.series([
				function(done) {
					if (toAdd.length == 0) done();
					else {
						git('update-index --add --stdin', req.param('path'), undefined, done, function(process) {
							var filesToAdd = toAdd.map(function(file) { return file.trim(); }).join('\n');
							process.stdin.end(filesToAdd);
						});
					}
				},
				function(done) {
					if (toRemove.length == 0) done();
					else {
						git('update-index --remove --stdin', req.param('path'), undefined, done, function(process) {
							var filesToRemove = toRemove.map(function(file) { return file.trim(); }).join('\n');
							process.stdin.end(filesToRemove);
						});
					}
				}
			], function() {
				git('commit ' + (req.body.amend ? '--amend' : '') + ' --file=- ', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res), function(process) {
					process.stdin.end(req.body.message);
				});
			});
		});
	});

	app.get(exports.pathPrefix + '/log', ensureAuthenticated, ensurePathExists, function(req, res){
		var limit = '';
		if (req.query.limit) limit = '--max-count=' + req.query.limit;
		git(gitConfigCliPager + ' log --decorate=full --pretty=fuller --all --parents ' + limit, req.param('path'), gitParser.parseGitLog, function(err, log) {
			if (err) {
				if (err.stderr.indexOf('fatal: bad default revision \'HEAD\'') == 0)
					res.json([]);
				else if (err.stderr.indexOf('fatal: Not a git repository') == 0)
					res.json([]);
				else
					res.json(400, err);
			} else {
				res.json(log);
			}
		});
	});

	app.get(exports.pathPrefix + '/branches', ensureAuthenticated, ensurePathExists, function(req, res){
		git('branch', req.param('path'), gitParser.parseGitBranches, jsonResultOrFail.bind(null, res));
	});

	app.post(exports.pathPrefix + '/branches', ensureAuthenticated, ensurePathExists, function(req, res){
		git('branch ' + (req.body.force ? '-f' : '') + ' "' + req.body.name.trim() +
			'" "' + (req.body.startPoint || 'HEAD').trim() + '"', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.del(exports.pathPrefix + '/branches', ensureAuthenticated, ensurePathExists, function(req, res){
		if (req.body.remote)
			git('push origin :"' + req.body.name.trim() + '"', req.param('path'), null, jsonResultOrFail.bind(null, res));
		else
			git('branch -D "' + req.body.name.trim() + '"', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.get(exports.pathPrefix + '/tags', ensureAuthenticated, ensurePathExists, function(req, res){
		git('tag -l', req.param('path'), gitParser.parseGitTags, jsonResultOrFail.bind(null, res));
	});

	app.get(exports.pathPrefix + '/remote/tags', ensureAuthenticated, ensurePathExists, function(req, res){
		git(' ls-remote --tags ', req.param('path'), gitParser.parseGitLsRemote, jsonResultOrFail.bind(null, res));
	});

	app.post(exports.pathPrefix + '/tags', ensureAuthenticated, ensurePathExists, function(req, res){
		git('tag ' + (req.body.force ? '-f' : '') + ' -a "' + req.body.name.trim() + '" -m "' +
			req.body.name.trim() + '" "' + (req.body.startPoint || 'HEAD').trim() + '"', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.del(exports.pathPrefix + '/tags', ensureAuthenticated, ensurePathExists, function(req, res){
		if (req.body.remote)
			git('push origin :"refs/tags/' + req.body.name.trim() + '"', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
		else
			git('tag -d "' + req.body.name.trim() + '"', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.post(exports.pathPrefix + '/checkout', ensureAuthenticated, ensurePathExists, function(req, res){
		git.stashAndPop(req.param('path'), function(done) {
			git('checkout "' + req.body.name.trim() + '"', req.param('path'), undefined, done);
		}, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.post(exports.pathPrefix + '/cherrypick', ensureAuthenticated, ensurePathExists, function(req, res){
		git.stashAndPop(req.param('path'), function(done) {
			git('cherry-pick "' + req.body.name.trim() + '"', req.param('path'), undefined, done);
		}, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.get(exports.pathPrefix + '/checkout', ensureAuthenticated, ensurePathExists, function(req, res){
		var HEADFile = path.join(req.param('path'), '.git', 'HEAD');
		if (!fs.existsSync(HEADFile)) 
			return res.json(400, { errorCode: 'not-a-repository', error: 'No such file: ' + HEADFile });
		fs.readFile(HEADFile, { encoding: 'utf8' }, function(err, text) {
			if (err) res.json(400, err);
			text = text.toString();
			var rows = text.split('\n');
			var branch = rows[0].slice('ref: refs/heads/'.length);
			res.json(branch);
		});
	});

	app.get(exports.pathPrefix + '/remotes', ensureAuthenticated, ensurePathExists, function(req, res){
		git('remote', req.param('path'), gitParser.parseGitRemotes, jsonResultOrFail.bind(null, res));
	});

	app.get(exports.pathPrefix + '/remotes/:name', ensureAuthenticated, ensurePathExists, function(req, res){
		git.remoteShow(req.param('path'), req.params.name, jsonResultOrFail.bind(null, res));
	});

	app.post(exports.pathPrefix + '/merge', ensureAuthenticated, ensurePathExists, function(req, res) {
		git('merge "' + req.body.with.trim() + '"', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.post(exports.pathPrefix + '/merge/continue', ensureAuthenticated, ensurePathExists, function(req, res) {
		git('commit --file=- ', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res), function(process) {
			process.stdin.end(req.body.message);
		});
	});

	app.post(exports.pathPrefix + '/merge/abort', ensureAuthenticated, ensurePathExists, function(req, res) {
		git('merge --abort', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});


	app.post(exports.pathPrefix + '/rebase', ensureAuthenticated, ensurePathExists, function(req, res) {
		git('rebase "' + req.body.onto.trim() + '"', req.param('path'), undefined, function(err) {
			if (err) {
				if (err.stderr.indexOf('Failed to merge in the changes.') == 0) {
					err.errorCode = 'merge-failed';
					res.json(400, err);
					return true;
				}
				res.json(400, err);
				return;
			}
			res.json({});
			emitRepoChanged(req.param('path'));
		});
	});

	app.post(exports.pathPrefix + '/rebase/continue', ensureAuthenticated, ensurePathExists, function(req, res) {
		git('rebase --continue', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.post(exports.pathPrefix + '/rebase/abort', ensureAuthenticated, ensurePathExists, function(req, res) {
		git('rebase --abort', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.post(exports.pathPrefix + '/resolveconflicts', ensureAuthenticated, ensurePathExists, function(req, res) {
		git('add ' + req.body.files.map(function(file) { return '"' + file + '"'; }).join(' '), req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.post(exports.pathPrefix + '/submodules', ensureAuthenticated, ensurePathExists, function(req, res) {
		git('submodule add "' + req.body.submoduleUrl.trim() + '" "' + req.body.submodulePath.trim() + '"', req.param('path'), null, jsonResultOrFailAndTriggerChange.bind(null, req.param('path'), res));
	});

	app.get(exports.pathPrefix + '/gitconfig', ensureAuthenticated, function(req, res){
		git('config --list', undefined, gitParser.parseGitConfig, function(err, gitConfig) {
			if (err) return res.json(400, err);
			res.json(gitConfig);
		});
	});

	// This method isn't called by the client but by credentials-helper.js
	app.get(exports.pathPrefix + '/credentials', ensureAuthenticated, function(req, res) {
		var socket = sockets[req.query.socketId];
		socket.once('credentials', function(data) {
			res.json(data);
		});
		socket.emit('request-credentials');
	});


	if (config.gerrit) {

		app.get(exports.pathPrefix + '/gerrit/commithook', ensureAuthenticated, ensurePathExists, function(req, res) {
			var repoPath = req.param('path');
			var hookPath = path.join(repoPath, '.git', 'hooks', 'commit-msg');
			if (fs.existsSync(hookPath)) res.json({ exists: true });
			else res.json({ exists: false });
		});

		app.post(exports.pathPrefix + '/gerrit/commithook', ensureAuthenticated, ensurePathExists, function(req, res) {
			var repoPath = req.param('path');
			git.remoteShow(repoPath, 'origin', function(err, remote) {
				if (err) return res.json(400, err);
				if (!remote.fetch.host) throw new Error("Failed to parse host from: " + remote.fetch.address);
				var command = 'scp -p ';
				if (remote.fetch.port) command += ' -P ' + remote.fetch.port + ' ';
				command += remote.fetch.host + ':hooks/commit-msg .git/hooks/';
				var hooksPath = path.join(repoPath, '.git', 'hooks');
				if (!fs.existsSync(hooksPath)) fs.mkdirSync(hooksPath);
				child_process.exec(command, { cwd: repoPath },
					function (err, stdout, stderr) {
						if (err) return res.json(400, { error: err, stdout: stdout, stderr: stderr });
						res.json({});
						emitRepoChanged(req.param('path'));
					});
			});
		});

		app.get(exports.pathPrefix + '/gerrit/changes', ensureAuthenticated, ensurePathExists, function(req, res) {
			var repoPath = req.param('path');
			git.remoteShow(repoPath, 'origin', function(err, remote) {
				if (err) return res.json(400, err);
				if (!remote.fetch.host) throw new Error("Failed to parse host from: " + remote.fetch.address);
				var command = 'query --format=JSON --current-patch-set status:open project:' + remote.fetch.project + '';
				gerrit(remote.fetch, command, res, function(err, result) {
					if (err) return;
					result = result.split('\n').filter(function(r) { return r.trim(); });
					result = result.map(function(r) { return JSON.parse(r); });
					res.json(result);
				});
			});
		});

	}

	if (config.dev) {

		app.post(exports.pathPrefix + '/testing/createdir', ensureAuthenticated, function(req, res){
			temp.mkdir('test-temp-dir', function(err, path) {
				res.json({ path: path });
			});
		});
		app.post(exports.pathPrefix + '/testing/createsubdir', ensureAuthenticated, function(req, res){
			fs.mkdir(req.body.dir, function() {
				res.json({});
			});
		});
		app.post(exports.pathPrefix + '/testing/createfile', ensureAuthenticated, function(req, res){
			var content = req.body.content;
			if (req.body.content === undefined) content = ('test content\n' + Math.random() + '\n');
			fs.writeFileSync(req.body.file, content);
			res.json({ });
		});
		app.post(exports.pathPrefix + '/testing/changefile', ensureAuthenticated, function(req, res){
			var content = req.body.content;
			if (req.body.content === undefined) content = ('test content\n' + Math.random() + '\n');
			fs.writeFileSync(req.body.file, content);
			res.json({ });
		});
		app.post(exports.pathPrefix + '/testing/removefile', ensureAuthenticated, function(req, res){
			fs.unlinkSync(req.body.file);
			res.json({ });
		});
		app.post(exports.pathPrefix + '/testing/cleanup', ensureAuthenticated, function(req, res){
			temp.cleanup();
			res.json({ });
		});
	}

};
