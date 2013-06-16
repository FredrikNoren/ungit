var child_process = require('child_process');
var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var path = require('path');
var temp = require('temp');
var socketIO = require('socket.io');
var watchr = require('watchr');
var async=  require('async');
var Ssh2Connection = require('ssh2');
var gitParser = require('./git-parser');

exports.pathPrefix = '';

exports.registerApi = function(app, server, config) {

	app.use(express.bodyParser());

	var cliConfigPager = '-c core.pager=cat';

	var sockets = [];

	if (server) {
		var io = socketIO.listen(server);
		io.sockets.on('connection', function (socket) {
			sockets.push(socket);
			socket.emit('socketId', sockets.length - 1);
			socket.on('watch', function (data) {
				var watchOptions = {
					path: data.path,
					ignoreCommonPatterns: false,
					listener: function() {
						socket.emit('changed');
					},
					next: function(err, watchers) {
						socket.emit('ready');
					}
				};
				if (data.safeMode) watchOptions.preferredMethods = ['watchFile', 'watch'];
				watchr.watch(watchOptions);

				// Just to make it painful to work with if we don't handle changes correctly
				//if (config.debug) setInterval(function() { socket.emit('changed'); }, 1000);
			});
		});
	}

	var verifyPath = function(path, res) {
		if (!fs.existsSync(path)) {
			res.json(400, { error: 'No such path: ' + path, errorCode: 'no-such-path' });
			return false;
		} else {
			return true;
		}
	}

	var git = function(command, repoPath, res, parser, callback) {
		command = 'git ' + command;
		return child_process.exec(command, { cwd: repoPath, maxBuffer: 1024 * 1024 * 10 },
			function (error, stdout, stderr) {
				if (error !== null) {
					var err = { errorCode: 'unkown', command: command, error: error.toString(), stderr: stderr, stdout: stdout };
					if (stderr.indexOf('Not a git repository') >= 0)
						err.errorCode = 'not-a-repository';
					if (!callback || !callback(err, stdout))
						res.json(400, err);
				}
				else {
					if (callback) callback(null, parser ? parser(stdout) : stdout);
					else res.json(parser ? parser(stdout) : {});
				}
		});
	}
	git.status = function(repoPath, res, callback) {
		git('status -s -b -u', repoPath, res, gitParser.parseGitStatus, callback);
	}
	git.remoteShow = function(repoPath, remoteName, res, callback) {
		git('remote show ' + remoteName, repoPath, res, gitParser.parseGitRemoteShow, callback);
	}
	git.stashAndPop = function(repoPath, res, callback) {
		var hadLocalChanges = true;
		async.series([
			function(done) {
				git('stash', repoPath, res, undefined, function(err, res) {
					if (res.indexOf('No local changes to save') != -1) {
						hadLocalChanges = false;
						done();
						return true;
					}
					if (!err) {
						done();
						return true;
					}
				});
			},
			function(done) {
				callback(done);
			},
			function(done) {
				if(!hadLocalChanges) done(); 
				else git('stash pop', repoPath, res, undefined, done);
			},
		], function(err) {
			if (err) res.json(400, err);
			else res.json({});
		});
	}

	app.get(exports.pathPrefix + '/status', function(req, res){
		var repoPath = req.query.path;
		if (!verifyPath(repoPath, res)) return;
		git.status(repoPath, res);
	});

	app.post(exports.pathPrefix + '/init', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		git('init' + (req.body.bare ? ' --bare --shared' : ''), req.body.path, res);
	});

	app.post(exports.pathPrefix + '/clone', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		var url = req.body.url.trim();
		if (url.indexOf('git clone ') == 0) url = url.slice('git clone '.length);
		git('clone "' + url + '" ' + '"' + req.body.destinationDir.trim() + '"', req.body.path, res);
	});

	app.post(exports.pathPrefix + '/fetch', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		git('fetch ' + (req.body.ref ? 'origin ' + req.body.ref : ''), req.body.path, res, undefined, function(err, text) {
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
			}
		});
	});

	app.post(exports.pathPrefix + '/push', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		var credentialsHelperPath = path.resolve(__dirname, 'credentials-helper.js').replace(/\\/g, '/');
		var credentialsOption = '-c credential.helper="!node ' + credentialsHelperPath + ' ' + req.body.socketId + '"';
		git(credentialsOption + ' push origin HEAD' + (req.body.remoteBranch ? ':' + req.body.remoteBranch : ''), req.body.path, res);
	});

	app.post(exports.pathPrefix + '/reset', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		git.stashAndPop(req.body.path, res, function(done) {
			git('reset --hard "' + req.body.to + '"', req.body.path, res, undefined, done);
		});
	});

	app.get(exports.pathPrefix + '/diff', function(req, res) {
		var repoPath = req.query.path;
		if (!verifyPath(repoPath, res)) return;
		git.status(repoPath, res, function(err, status) {
			if (err) return res.json(400, err);
			var file = status.files[req.query.file];
			if (!file) {
				if (fs.existsSync(path.join(repoPath, req.query.file))) res.json([]);
				else res.json(400, { error: 'No such file: ' + req.query.file, errorCode: 'no-such-file' });
			} else if (!file.isNew) {
				git(cliConfigPager + ' diff HEAD -- "' + req.query.file.trim() + '"', repoPath, res, gitParser.parseGitDiff);
			} else {
				fs.readFile(path.join(repoPath, req.query.file), { encoding: 'utf8' }, function(err, text) {
					if (err) return res.json(400, { error: err });
					var diffs = [];
					var diff = { };
					text = text.toString();
					diff.lines = text.split('\n').map(function(line, i) { return [null, i, line]; });
					diffs.push(diff);
					res.json(diffs);
				});
			}
		});
	});

	app.post(exports.pathPrefix + '/discardchanges', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		git('checkout -- "' + req.body.file.trim() + '"', req.body.path, res, null, function(err, text) {
			if (err !== null) {
				if (err.stderr.trim() == 'error: pathspec \'' + req.body.file.trim() + '\' did not match any file(s) known to git.') {
					fs.unlink(path.join(req.body.path, req.body.file), function(err) {
						if (err) res.json(400, { command: 'unlink', error: err });
						else res.json({});
					});
					return true;
				}
				return;
			}
			
			res.json({});
		});
	});

	app.post(exports.pathPrefix + '/commit', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		if (req.body.message === undefined)
			return res.json(400, { error: 'Must specify commit message' });
		if ((!(req.body.files instanceof Array) || req.body.files.length == 0) && !req.body.amend)
			return res.json(400, { error: 'Must specify files or amend to commit' });
		git.status(req.body.path, res, function(err, status) {
			var toAdd = [];
			var toRemove = [];
			for(var v in req.body.files) {
				var file = req.body.files[v];
				var fileStatus = status.files[file] || status.files[path.relative(req.body.path, file)];
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
					else git('add ' + toAdd.map(function(file) { return '"' + file.trim() + '"'; }).join(' '), req.body.path, res, undefined, done);
				},
				function(done) {
					if (toRemove.length == 0) done();
					else git('rm --cached -- ' + toRemove.map(function(file) { return '"' + file.trim() + '"'; }).join(' '), req.body.path, res, undefined, done);
				}
			], function() {
				var process = git('commit ' + (req.body.amend ? '--amend' : '') + ' --file=- ', req.body.path, res);
				process.stdin.end(req.body.message);
			});
		});
	});

	app.get(exports.pathPrefix + '/log', function(req, res){
		if (!verifyPath(req.query.path, res)) return;
		var limit = '';
		if (req.query.limit) limit = '--max-count=' + req.query.limit;
		git(cliConfigPager + ' log --decorate=full --pretty=fuller --all --parents ' + limit, req.query.path, res, gitParser.parseGitLog, function(err, log) {
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

	app.get(exports.pathPrefix + '/branches', function(req, res){
		if (!verifyPath(req.query.path, res)) return;
		git('branch', req.query.path, res, gitParser.parseGitBranches);
	});

	app.post(exports.pathPrefix + '/branches', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		git('branch ' + (req.body.force ? '-f' : '') + ' "' + req.body.name.trim() + '" "' + (req.body.startPoint || 'HEAD').trim() + '"', req.body.path, res);
	});

	app.post(exports.pathPrefix + '/branch', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		git.stashAndPop(req.body.path, res, function(done) {
			git('checkout "' + req.body.name.trim() + '"', req.body.path, res, undefined, done);
		});
	});

	app.get(exports.pathPrefix + '/branch', function(req, res){
		if (!verifyPath(req.query.path, res)) return;
		var HEADFile = path.join(req.query.path, '.git', 'HEAD');
		if (!fs.existsSync(HEADFile)) 
			return res.json(400, { errorCode: 'not-a-repository', error: 'No such file: ' + HEADFile });
		fs.readFile(HEADFile, { encoding: 'utf8' }, function(err, text) {
			text = text.toString();
			var rows = text.split('\n');
			var branch = rows[0].slice('ref: refs/heads/'.length);
			res.json(branch);
		});
	});

	app.get(exports.pathPrefix + '/remotes', function(req, res){
		if (!verifyPath(req.query.path, res)) return;
		git('remote', req.query.path, res, gitParser.parseGitRemotes);
	});

	app.get(exports.pathPrefix + '/remotes/:name', function(req, res){
		if (!verifyPath(req.query.path, res)) return;
		git.remoteShow(req.query.path, req.params.name, res);
	});

	app.post(exports.pathPrefix + '/rebase', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		git('rebase "' + req.body.onto.trim() + '"', req.body.path, res);
	});


	app.post(exports.pathPrefix + '/submodules', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		git('submodule add "' + req.body.submoduleUrl.trim() + '" "' + req.body.submodulePath.trim() + '"', req.body.path, res);
	});

	app.get(exports.pathPrefix + '/config', function(req, res){
		git('config --list', undefined, res, gitParser.parseGitConfig, function(err, gitConfig) {
			if (err) return;
			config.git = gitConfig;
			res.json(config);
		});
	});

	// This method isn't called by the client but by credentials-helper.js
	app.get(exports.pathPrefix + '/credentials', function(req, res) {
		var socket = sockets[req.query.socketId];
		socket.once('credentials', function(data) {
			res.json(data);
		});
		socket.emit('request-credentials');
	});


	if (config.gerritIntegration) {

		var getGerritAddress = function(repoPath, res, callback) {
			git.remoteShow(repoPath, 'origin', res, function(err, remote) {
				if (err) return res.json(400, err);
				if (remote.fetch.indexOf('ssh://') == 0) {
					var ss = remote.fetch.slice('ssh://'.length).split('/');
					var gerritUri = ss[0].split(':');
					var host = gerritUri[0];
					var port = gerritUri[1];
					var project = ss[1];
					project = project.slice(project.length - '.git'.length, project.length);
					callback(null, host, port, project);
				} else if(remote.fetch.indexOf('@') != -1) {
					var ss = remote.fetch.split('@');
					var gerritUri = ss[1].split(':');
					var host = gerritUri[0];
					var port = null;
					var project = gerritUri[1];
					if (project.indexOf('.git') == project.length - '.git'.length)
						project = project.slice(0, project.length - '.git'.length);
					callback(ss[0], host, port, project);
				} else {
					res.json(400, { error: 'Unsupported gerrit remote: ' + remote.fetch });
				}
			});
		}

		app.get(exports.pathPrefix + '/gerrit/commithook', function(req, res) {
			var repoPath = req.query.path;
			if (!verifyPath(repoPath, res)) return;
			var hookPath = path.join(repoPath, '.git', 'hooks', 'commit-msg');
			if (fs.existsSync(hookPath)) res.json({ exists: true });
			else res.json({ exists: false });
		});

		app.post(exports.pathPrefix + '/gerrit/commithook', function(req, res) {
			var repoPath = req.body.path;
			if (!verifyPath(repoPath, res)) return;
			getGerritAddress(repoPath, res, function(host, port) {
					var command = 'scp -p ';
					if (port) command += ' -P ' + port + ' ';
					command += host + ':hooks/commit-msg .git/hooks/';
					child_process.exec(command, { cwd: repoPath },
						function (error, stdout, stderr) {
							if (err) return res.json(400, { err: err });
							res.json({});
						});
			});
		});

		var ssh2 = function(username, host, port, command, callback) {
			var connection = new Ssh2Connection();
			connection.on('connect', function() {
			});
			connection.on('ready', function() {
				connection.exec(command, function(err, stream) {
					if (err) return callback(err);
					var result = '';
					stream.on('data', function(data, extended) {
						result += data.toString();
					});
					stream.on('end', function() {
						callback(null, result);
					});
				});
			});
			connection.on('error', function(err) {
				callback(err);
			});
			connection.connect({
				host: host,
				port: port,
				agent: 'pageant',
				username: username
			});
		};

		app.get(exports.pathPrefix + '/gerrit/changes', function(req, res) {
			var repoPath = req.query.path;
			if (!verifyPath(repoPath, res)) return;
			getGerritAddress(repoPath, res, function(username, host, port, project) {
					var command = 'gerrit query --format=JSON --current-patch-set status:open project:' + project + '';
					ssh2(username, host, port, command, function(err, result) {
							if (err) return res.json(400, { err: err });
							result = result.split('\n').filter(function(r) { return r.trim(); });
							result = result.map(function(r) { return JSON.parse(r); });
							res.json(result);
					});
			});
		});

	}

	if (config.dev) {

		app.post(exports.pathPrefix + '/testing/createdir', function(req, res){
			temp.mkdir('test-temp-dir', function(err, path) {
				res.json({ path: path });
			});
		});
		app.post(exports.pathPrefix + '/testing/createsubdir', function(req, res){
			fs.mkdir(req.body.dir, function() {
				res.json({});
			});
		});
		app.post(exports.pathPrefix + '/testing/createfile', function(req, res){
			var content = req.body.content;
			if (req.body.content === undefined) content = ('test content\n' + Math.random() + '\n');
			fs.writeFileSync(req.body.file, content);
			res.json({ });
		});
		app.post(exports.pathPrefix + '/testing/changefile', function(req, res){
			var content = req.body.content;
			if (req.body.content === undefined) content = ('test content\n' + Math.random() + '\n');
			fs.writeFileSync(req.body.file, content);
			res.json({ });
		});
		app.post(exports.pathPrefix + '/testing/removefile', function(req, res){
			fs.unlinkSync(req.body.file);
			res.json({ });
		});
		app.post(exports.pathPrefix + '/testing/cleanup', function(req, res){
			temp.cleanup();
			res.json({ });
		});
	}

};
