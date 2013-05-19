var child_process = require('child_process');
var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var path = require('path');
var temp = require('temp');
var socketIO = require('socket.io');
var watchr = require('watchr');
var gitCliParser = require('./gitCliParser');

exports.pathPrefix = '';

exports.registerApi = function(app, server, dev) {

	app.use(express.bodyParser());

	if (server) {
		var io = socketIO.listen(server);
		io.sockets.on('connection', function (socket) {
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
				console.dir(watchOptions);
				watchr.watch(watchOptions);
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

	app.get(exports.pathPrefix + '/status', function(req, res){
		var repoPath = req.query.path;
		if (!verifyPath(repoPath, res)) return;
		git('status -s -b', repoPath, res, gitCliParser.parseGitStatus);
	});

	app.post(exports.pathPrefix + '/init', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		git('init', req.body.path, res);
	});

	app.post(exports.pathPrefix + '/stage', function(req, res) {
		if (!verifyPath(req.body.path)) return;
		git('add "' + req.body.file + '"', req.body.path, res);
	});

	app.post(exports.pathPrefix + '/unstage', function(req, res) {
		var repoPath = req.body.path;
		if (!verifyPath(repoPath, res)) return;
		git('status -s -b', repoPath, res, gitCliParser.parseGitStatus, function(err, status) {
			if (err) return res.json(400, err);
			var file = _.find(status.files, function(file) { return file.name == req.body.file });
			if (file.isNew) {
				git('rm --cached "' + req.body.file + '"', repoPath, res);
			} else {
				git('reset HEAD "' + req.body.file + '"', repoPath, res, null, function(err, text) {
					if (err && 
						err.stderr != 'warning: LF will be replaced by CRLF in somefile.\nThe file will have its original line endings in your working directory.\n' &&
						err.stderr != '') 
						res.json(400, err);
					else
						res.json({});
				});
			}
		});
	});

	app.get(exports.pathPrefix + '/diff', function(req, res) {
		var repoPath = req.query.path;
		if (!verifyPath(repoPath, res)) return;
		git('status -s -b', repoPath, res, gitCliParser.parseGitStatus, function(err, status) {
			if (err) return res.json(400, err);
			var file = _.find(status.files, function(file) { return file.name == req.query.file });
			if (file.staged) {
				git('diff --cached "' + req.query.file + '"', repoPath, res, gitCliParser.parseGitDiff);
			} else {
				git('diff "' + req.query.file + '"', repoPath, res, gitCliParser.parseGitDiff);
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
		git('commit -m "' + req.body.message + '"', req.body.path, res);
	});

	app.get(exports.pathPrefix + '/log', function(req, res){
		if (!verifyPath(req.query.path, res)) return;
		git('log', req.query.path, res, gitCliParser.parseGitLog, function(err, log) {
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

	app.get(exports.pathPrefix + '/config', function(req, res){
		git('config --list', undefined, res, gitCliParser.parseGitConfig);
	});

	if (dev) {

		var testDir;

		app.post(exports.pathPrefix + '/testing/createdir', function(req, res){
			temp.mkdir('test-temp-dir', function(err, path) {
				testDir = path;
				res.json({ path: path });
			});
		});
		app.post(exports.pathPrefix + '/testing/createfile', function(req, res){
			fs.writeFileSync(path.join(testDir, req.body.file), 'test content\n');
			res.json({ });
		});
		app.post(exports.pathPrefix + '/testing/changefile', function(req, res){
			fs.writeFileSync(path.join(testDir, req.body.file), 'test content\n' + Math.random() + '\n');
			res.json({ });
		});
		app.post(exports.pathPrefix + '/testing/removedir', function(req, res){
			temp.cleanup();
			res.json({ });
		});
	}

};
