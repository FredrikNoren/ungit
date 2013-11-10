var expect = require('expect.js');
var async = require('async');
var path = require('path');
var restGit = require('../source/git-api');

var common = exports;

common.wrapErrorHandler = function(callback) {
	return function(err, res) {
		var r = callback(err, res);
		if (err && !r) {
			console.log(res.req.method + ' ' + res.req.path);
			console.dir(err);
			console.dir(res.body);
		}
	}
}

common.get = function(req, path, payload, callback) {
	var r = req
		.get(restGit.pathPrefix + path);
	if (payload) {
		payload.socketId = 'ignore';
		r.query(payload);
	}
	r
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(200)
		.end(common.wrapErrorHandler(callback));
}

common.getPng = function(req, path, payload, callback) {
	var r = req
		.get(restGit.pathPrefix + path);
	if (payload) {
		payload.socketId = 'ignore';
		r.query(payload);
	}
	r
		.set('Accept', 'application/json')
		.expect('Content-Type', 'image/png')
		.expect(200)
		.end(common.wrapErrorHandler(callback));
}

common.post = function(req, path, payload, callback) {
	var r = req
		.post(restGit.pathPrefix + path);
	if (payload) {
		payload.socketId = 'ignore';
		r.send(payload);
	}
	r
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(200)
		.end(common.wrapErrorHandler(callback));
}
common.delete = function(req, path, payload, callback) {
	var r = req
		.del(restGit.pathPrefix + path);
	if (payload) {
		payload.socketId = 'ignore';
		r.send(payload);
	}
	r
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(200)
		.end(common.wrapErrorHandler(callback));
}

common.createEmptyRepo = function(req, callback) {
	var testDir;
	common.post(req, '/testing/createtempdir', undefined, function(err, res) {
		if (err) return callback(err);
		expect(res.body.path).to.be.ok();
		testDir = res.body.path;
		common.post(req, '/init', { path: testDir }, function(err) {
			callback(err, testDir);
		});
	});
}

common.createSmallRepo = function(req, callback) {
	common.createEmptyRepo(req, function(err, dir) {
		if (err) return callback(err);
		var testFile = 'smalltestfile.txt';
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile) }, done); },
			function(done) { common.post(req, '/commit', { path: dir, message: 'Init', files: [testFile] }, done); }
		], function(err, res) {
			callback(err, dir);
		});
	});
}

// Used by ko tests, which doesn't really require dom manipulation, but does require these things to be defined.
common.initDummyBrowserEnvironment = function() {
	window = {};
	document = {
		createElement: function() {
			return { getElementsByTagName: function() { return []; } }
		},
		createComment: function() {
			return {};
		}
	};
	navigator = {};
}