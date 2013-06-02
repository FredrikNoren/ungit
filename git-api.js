var child_process = require('child_process');
var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var path = require('path');
var temp = require('temp');
var socketIO = require('socket.io');
var watchr = require('watchr');
var gitParser = require('./git-parser');

exports.pathPrefix = '';

var debug = true;

exports.registerApi = function(app, server, dev) {

	app.use(express.bodyParser());

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
				//if (debug) setInterval(function() { socket.emit('changed'); }, 1000);
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
		child_process.exec(command, { cwd: repoPath },
			function (error, stdout, stderr) {
				if (error !== null) {
					var err = { errorCode: 'unkown', command: command, error: error, stderr: stderr };
					if (stderr.indexOf('Not a git repository') >= 0)
						err.errorCode = 'not-a-repository';
					if (callback) callback(err, stdout);
					else res.json(400, err);
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
		git('clone "' + req.body.url + '" ' + '"' + req.body.destinationDir + '"', req.body.path, res);
	});

	app.post(exports.pathPrefix + '/fetch', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		git('fetch', req.body.path, res, undefined, function(err, text) {
			if (err) {
				if (err.stderr.indexOf('fatal: No remote repository specified.') == 0) {
					res.json({});
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
		var credentialsOption = '';
		if (req.body.socketId)
			credentialsOption = '-c credential.helper="!node ' + credentialsHelperPath + ' ' + req.body.socketId + '"';
		git(credentialsOption + ' push origin HEAD', req.body.path, res);
	});

	app.post(exports.pathPrefix + '/reset', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		git('reset --hard "' + req.body.to + '"', req.body.path, res);
	});

	app.get(exports.pathPrefix + '/diff', function(req, res) {
		var repoPath = req.query.path;
		if (!verifyPath(repoPath, res)) return;
		git.status(repoPath, res, function(err, status) {
			if (err) return res.json(400, err);
			var file = status.files[req.query.file];
			if (!file) {
				res.json(400, { error: 'No such file: ' + req.query.file });
			} else if (!file.isNew) {
				git('diff HEAD -- "' + req.query.file + '"', repoPath, res, gitParser.parseGitDiff);
			} else {
				fs.readFile(path.join(repoPath, req.query.file), { encoding: 'utf8' }, function(err, text) {
					if (err) return res.json(400, { error: err });
					var diffs = [];
					var diff = { };
					text = text.toString();
					diff.lines = text.split('\n').map(function(line) { return '+\t' + line; });
					diffs.push(diff);
					res.json(diffs);
				});
			}
		});
	});

	app.post(exports.pathPrefix + '/discardchanges', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		git('checkout -- "' + req.body.file + '"', req.body.path, res, null, function(err, text) {
			if (err !== null) {
				if (err.stderr.trim() == 'error: pathspec \'' + req.body.file + '\' did not match any file(s) known to git.') {
					fs.unlink(path.join(req.body.path, req.body.file), function(err) {
						if (err) res.json(400, { command: 'unlink', error: err });
						else res.json({});
					})
				} else {
					res.json(400, err);
				}
			} else {
				res.json({});
			}
		});
	});

	app.post(exports.pathPrefix + '/commit', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		if (req.body.message === undefined)
			return res.json(400, { error: 'Must specify commit message' });
		if (!(req.body.files instanceof Array) || req.body.files.length == 0)
			return res.json(400, { error: 'Must specify files to commit' });
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
			git('add ' + toAdd.map(function(file) { return '"' + file + '"'; }).join(' '), req.body.path, res, undefined, function() {
				git('rm ' + toRemove.map(function(file) { return '"' + file + '"'; }).join(' '), req.body.path, res, undefined, function() {
					git('commit -m "' + req.body.message + '"', req.body.path, res);
				});
			});
		});
	});

	app.get(exports.pathPrefix + '/log', function(req, res){
		if (!verifyPath(req.query.path, res)) return;
		git('log --decorate=full --pretty=fuller --all --parents', req.query.path, res, gitParser.parseGitLog, function(err, log) {
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
		git('branch "' + req.body.name + '" "' + (req.body.startPoint || 'HEAD') + '"', req.body.path, res);
	});

	app.post(exports.pathPrefix + '/branch', function(req, res){
		if (!verifyPath(req.body.path, res)) return;
		git('checkout "' + req.body.name + '"', req.body.path, res);
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

	app.post(exports.pathPrefix + '/rebase', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		git('rebase "' + req.body.onto + '"', req.body.path, res);
	});

	app.get(exports.pathPrefix + '/config', function(req, res){
		git('config --list', undefined, res, gitParser.parseGitConfig);
	});

	// This method isn't called by the client but by credentials-helper.js
	app.get(exports.pathPrefix + '/credentials', function(req, res) {
		var socket = sockets[req.query.socketId];
		socket.once('credentials', function(data) {
			res.json(data);
		});
		socket.emit('request-credentials');
	});

	if (dev) {

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
			fs.writeFileSync(req.body.file, 'test content\n');
			res.json({ });
		});
		app.post(exports.pathPrefix + '/testing/changefile', function(req, res){
			fs.writeFileSync(req.body.file, 'test content\n' + Math.random() + '\n');
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
