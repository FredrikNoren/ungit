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
				watchr.watch(watchOptions);

				// Just to make it painful to work with if we don't handle changes correctly
				if (debug) setInterval(function() { socket.emit('changed'); }, 1000);
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
		git('status -s -b -u', repoPath, res, gitParser.parseGitStatus);
	});

	app.post(exports.pathPrefix + '/init', function(req, res) {
		if (!verifyPath(req.body.path, res)) return;
		git('init', req.body.path, res);
	});

	app.get(exports.pathPrefix + '/diff', function(req, res) {
		var repoPath = req.query.path;
		if (!verifyPath(repoPath, res)) return;
		git('status -s -b -u', repoPath, res, gitParser.parseGitStatus, function(err, status) {
			if (err) return res.json(400, err);
			var file = status.files[req.query.file];
			if (!file) {
				res.json(400, { error: 'No such file: ' + req.query.file });
			} else if (!file.isNew) {
				git('diff HEAD "' + req.query.file + '"', repoPath, res, gitParser.parseGitDiff);
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
		git('add ' + req.body.files.map(function(file) { return '"' + file + '"'; }).join(' '), req.body.path, res, undefined, function() {
			git('commit -m "' + req.body.message + '"', req.body.path, res);
		});
	});

	app.get(exports.pathPrefix + '/log', function(req, res){
		if (!verifyPath(req.query.path, res)) return;
		git('log', req.query.path, res, gitParser.parseGitLog, function(err, log) {
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

	app.get(exports.pathPrefix + '/config', function(req, res){
		git('config --list', undefined, res, gitParser.parseGitConfig);
	});

	if (dev) {

		var testDir;

		app.post(exports.pathPrefix + '/testing/createdir', function(req, res){
			temp.mkdir('test-temp-dir', function(err, path) {
				testDir = path;
				res.json({ path: path });
			});
		});
		app.post(exports.pathPrefix + '/testing/createsubdir', function(req, res){
			fs.mkdir(path.join(testDir, req.body.dir), function() {
				res.json({});
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
