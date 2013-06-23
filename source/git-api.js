var child_process = require('child_process');
var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var path = require('path');
var temp = require('temp');
var socketIO = require('socket.io');
var watchr = require('watchr');
var async=  require('async');
var git = require('./git');
var gerrit = require('./gerrit');
var gitParser = require('./git-parser');
var winston = require('winston');

exports.pathPrefix = '';

exports.registerApi = function(app, server, config) {

	app.use(express.bodyParser());

	var gitConfigCliPager = '-c core.pager=cat';

	var sockets = [];

	if (server) {
		var io = socketIO.listen(server, {
			logger: {
				debug: winston.debug.bind(winston),
				info: winston.info.bind(winston),
				error: winston.error.bind(winston),
				warn: winston.warn.bind(winston)
			}
		});
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
		git(credentialsOption + ' push origin ' + (req.body.localBranch ? req.body.localBranch : 'HEAD') + (req.body.remoteBranch ? ':' + req.body.remoteBranch : ''), req.body.path, res);
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
				git(gitConfigCliPager + ' diff HEAD -- "' + req.query.file.trim() + '"', repoPath, res, gitParser.parseGitDiff);
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

	app.post(exports.pathPrefix + '/discardchanges', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		if (req.body.all) {
			git('reset --hard HEAD', req.body.path, res, null, function(err) {
				git('clean -fd', req.body.path, res);
			});
		} else {
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
		}
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
		git(' ls-remote --tags ', req.query.path, res, gitParser.parseGitLsRemote, function(err, remoteTags) {
			if (!err || err.stderr.indexOf('fatal: No remote configured to list refs from.') == 0) {
				var sha1ToRemoteTag = {};
				if (!err) remoteTags.forEach(function(ref) {
					if (ref.name.indexOf('^{}') != -1)
						sha1ToRemoteTag[ref.sha1] = ref.name.slice(0, ref.name.length - '^{}'.length);
				});

				git(gitConfigCliPager + ' log --decorate=full --pretty=fuller --all --parents ' + limit, req.query.path, res, gitParser.parseGitLog, function(err, log) {
					if (err) {
						if (err.stderr.indexOf('fatal: bad default revision \'HEAD\'') == 0)
							res.json([]);
						else if (err.stderr.indexOf('fatal: Not a git repository') == 0)
							res.json([]);
						else
							res.json(400, err);
					} else {
						log.forEach(function(node) {
							if (sha1ToRemoteTag[node.sha1]) {
								node.refs.push('remote-tag: ' + sha1ToRemoteTag[node.sha1]);
							}
						});
						res.json(log);
					}
				});

				return true;
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

	app.del(exports.pathPrefix + '/branches', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		if (req.body.remote)
			git('push origin :"' + req.body.name.trim() + '"', req.body.path, res);
		else
			git('branch -D "' + req.body.name.trim() + '"', req.body.path, res);
	});

	app.get(exports.pathPrefix + '/tags', function(req, res){
		if (!verifyPath(req.query.path, res)) return;
		git('tag -l', req.query.path, res, gitParser.parseGitTags);
	});

	app.post(exports.pathPrefix + '/tags', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		git('tag ' + (req.body.force ? '-f' : '') + ' -a "' + req.body.name.trim() + '" -m "' + req.body.name.trim() + '" "' + (req.body.startPoint || 'HEAD').trim() + '"', req.body.path, res);
	});

	app.del(exports.pathPrefix + '/tags', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		if (req.body.remote)
			git('push origin :"refs/tags/' + req.body.name.trim() + '"', req.body.path, res);
		else
			git('tag -d "' + req.body.name.trim() + '"', req.body.path, res);
	});

	app.post(exports.pathPrefix + '/checkout', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		git.stashAndPop(req.body.path, res, function(done) {
			git('checkout "' + req.body.name.trim() + '"', req.body.path, res, undefined, done);
		});
	});

	app.get(exports.pathPrefix + '/checkout', function(req, res){
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
			res.json(gitConfig);
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


	if (config.gerrit) {

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
			gerrit.getGerritAddress(repoPath, res, function(host, port) {
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

		app.get(exports.pathPrefix + '/gerrit/changes', function(req, res) {
			var repoPath = req.query.path;
			if (!verifyPath(repoPath, res)) return;
			gerrit.getGerritAddress(repoPath, res, function(username, host, port, project) {
					var command = 'query --format=JSON --current-patch-set status:open project:' + project + '';
					gerrit(username, host, port, command, res, function(err, result) {
						if (err) return;
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
