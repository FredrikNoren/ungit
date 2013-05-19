var child_process = require('child_process');
var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var path = require('path');
var temp = require('temp');
var socketIO = require('socket.io');
var watchr = require('watchr');

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

	var parseGitStatus = function(text, result) {
		var lines = text.split('\n');
		result.branch = _.last(lines[0].split(' '));
		result.inited = true;
		result.files = [];
		lines.slice(1).forEach(function(line) {
			if (line == '') return;
			var status = line.slice(0, 2);
			var filename = line.slice(3).trim();
			if (filename[0] == '"' && _.last(filename) == '"')
				filename = filename.slice(1, filename.length - 1);
			var file = { name: filename };
			file.staged = status[0] == 'A' || status[0] == 'M';
			file.isNew = status[0] == '?' || status[0] == 'A';
			result.files.push(file);
		});
	}

	app.get(exports.pathPrefix + '/status', function(req, res){
		var path = req.query.path;
		if (!fs.existsSync(path))
			return res.json(400, { status: 'fail', error: 'No such path: ' + path });
		child_process.exec('git status -s -b', { cwd: path },
			function (error, stdout, stderr) {
				if (error !== null) {
					if (stderr.indexOf('Not a git repository') >= 0)
						res.json(200, { status: 'ok', inited: false });
					else
						res.json(400, { status: 'fail', error: error, stderr: stderr });
				}
				else {
					var result = { status: 'ok' };
					parseGitStatus(stdout, result);
					res.json(result);
				}
		});
	});

	app.post(exports.pathPrefix + '/init', function(req, res){
		var path = req.body.path;
		if (!fs.existsSync(path))
			return res.json(400, { status: 'fail', error: 'No such path: ' + path });
		child_process.exec('git init', { cwd: path },
			function (error, stdout, stderr) {
				if (error !== null)
					res.json(400, { status: 'fail', error: error, stderr: stderr });
				else
					res.json({ status: 'ok' });
		});
	});

	app.post(exports.pathPrefix + '/stage', function(req, res){
		var path = req.body.path;
		if (!fs.existsSync(path))
			return res.json(400, { status: 'fail', error: 'No such path: ' + path });
		child_process.exec('git add "' + req.body.file + '"', { cwd: path },
			function (error, stdout, stderr) {
				if (error !== null)
					res.json(400, { status: 'fail', error: error, stderr: stderr });
				else
					res.json({ status: 'ok' });
		});
	});

	app.post(exports.pathPrefix + '/unstage', function(req, res){
		var path = req.body.path;
		if (!fs.existsSync(path))
			return res.json(400, { status: 'fail', error: 'No such path: ' + path });
		child_process.exec('git rm --cached "' + req.body.file + '"', { cwd: path },
			function (error, stdout, stderr) {
				if (error !== null)
					res.json(400, { status: 'fail', error: error, stderr: stderr });
				else
					res.json({ status: 'ok' });
		});
	});

	app.post(exports.pathPrefix + '/discardchanges', function(req, res){
		var repoPath = req.body.path;
		if (!fs.existsSync(repoPath))
			return res.json(400, { status: 'fail', error: 'No such path: ' + repoPath });
		child_process.exec('git checkout -- "' + req.body.file + '"', { cwd: repoPath },
			function (error, stdout, stderr) {
				if (error !== null) {
					if (stderr.trim() == 'error: pathspec \'' + req.body.file + '\' did not match any file(s) known to git.') {
						fs.unlink(path.join(repoPath, req.body.file), function(err) {
							if (err) res.json(400, { status: 'fail', error: err });
							else res.json({ status: 'ok' });
						})
					} else {
						res.json(400, { status: 'fail', error: error, stderr: stderr });
					}
				} else {
					res.json({ status: 'ok' });
				}
		});
	});

	app.post(exports.pathPrefix + '/commit', function(req, res){
		var path = req.body.path;
		if (!fs.existsSync(path))
			return res.json(400, { status: 'fail', error: 'No such path: ' + path });
		if (req.body.message === undefined)
			return res.json(400, { status: 'fail', error: 'Must specify commit message' });
		child_process.exec('git commit -m "' + req.body.message + '"', { cwd: path },
			function (error, stdout, stderr) {
				if (error !== null)
					res.json(400, { status: 'fail', error: error, stderr: stderr });
				else
					res.json({ status: 'ok' });
		});
	});

	var parseGitLog = function(data) {
		var commits = [];
		var currentCommmit;
		var inCommitIndex = 0;
		data.split('\n').forEach(function(row) {
			if (row.indexOf('commit ') == 0) {
				currentCommmit = { message: '' };
				commits.push(currentCommmit);
				inCommitIndex = 0;
			}
			if (inCommitIndex == 0)
				currentCommmit.sha1 = _.last(row.split(' '));
			else if (inCommitIndex == 1) {
				var author = row.split(' ').slice(1).join(' ');
				var capture = (/([^<]+)<([^>]+)>/g).exec(author);
				currentCommmit.authorName = capture[1].trim();
				currentCommmit.authorEmail = capture[2].trim();
			} else if (inCommitIndex == 2)
				currentCommmit.date = row.split(' ').slice(1).join(' ');
			else
				currentCommmit.message = (currentCommmit.message + '\n' + row).trim();
			if (inCommitIndex == 4)
				currentCommmit.title = row.trim();
			inCommitIndex++;
		});
		return commits;
	}

	app.get(exports.pathPrefix + '/log', function(req, res){
		var path = req.query.path;
		if (!fs.existsSync(path))
			return res.json(400, { status: 'fail', error: 'No such path: ' + path });
		child_process.exec('git log', { cwd: path },
			function (error, stdout, stderr) {
				if (error !== null) {
					if (stderr.indexOf('fatal: bad default revision \'HEAD\'') == 0)
						res.json({ status: 'ok', entries: [] });
					else if (stderr.indexOf('fatal: Not a git repository') == 0)
						res.json({ status: 'fail', error: 'Not a git repository', entries: [] });
					else
						res.json(400, { status: 'fail', error: error, stderr: stderr });
				}
				else {
					var data = parseGitLog(stdout);
					var result = { status: 'ok', entries: data };
					res.json(result);
				}
		});
	});

	var parseGitConfig = function(text) {
		var conf = {};
		text.split('\n').forEach(function(row) {
			var ss = row.split('=');
			conf[ss[0]] = ss[1];
		});
		return conf;
	}

	app.get(exports.pathPrefix + '/config', function(req, res){
		child_process.exec('git config --list', { },
			function (error, stdout, stderr) {
				if (error !== null) {
					res.json(400, { status: 'fail', error: error, stderr: stderr });
				} else {
					var data = parseGitConfig(stdout);
					var result = { status: 'ok', config: data };
					res.json(result);
				}
		});
	});

	if (dev) {

		var testDir;

		app.post(exports.pathPrefix + '/testing/createdir', function(req, res){
			temp.mkdir('test-temp-dir', function(err, path) {
				testDir = path;
				res.json({ status: 'ok', path: path });
			});
		});
		app.post(exports.pathPrefix + '/testing/createfile', function(req, res){
			fs.writeFileSync(path.join(testDir, req.body.file), 'test content');
			res.json({ status: 'ok' });
		});
		app.post(exports.pathPrefix + '/testing/changefile', function(req, res){
			fs.writeFileSync(path.join(testDir, req.body.file), 'test content\n' + Math.random());
			res.json({ status: 'ok' });
		});
		app.post(exports.pathPrefix + '/testing/removedir', function(req, res){
			temp.cleanup();
			res.json({ status: 'ok' });
		});
	}

};
