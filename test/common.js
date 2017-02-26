var expect = require('expect.js');
var path = require('path');
var restGit = require('../src/git-api');

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

common.get = function(req, path, payload) {
	var r = req
		.get(restGit.pathPrefix + path);
	if (payload) {
		payload.socketId = 'ignore';
		r.query(payload);
	}
	return r
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(200)
}

common.getPng = function(req, path, payload) {
	var r = req
		.get(restGit.pathPrefix + path);
	if (payload) {
		payload.socketId = 'ignore';
		r.query(payload);
	}
	return r
		.set('Accept', 'application/json')
		.expect('Content-Type', 'image/png')
		.expect(200)
}

common.post = function(req, path, payload) {
	var r = req
		.post(restGit.pathPrefix + path);
	if (payload) {
		payload.socketId = 'ignore';
		r.send(payload);
	}
	return r
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(200)
}
common.delete = function(req, path, payload) {
	var r = req
		.del(restGit.pathPrefix + path);
	if (payload) {
		payload.socketId = 'ignore';
		r.query(payload);
	}
	return r
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(200)
}

common.initRepo = function(req, config) {
	var testDir;
	return common.post(req, '/testing/createtempdir', config.path).then(function(res) {
		expect(res.body.path).to.be.ok();
		testDir = res.body.path;
		return common.post(req, '/init', { path: testDir, bare: !!config.bare });
	});
}

common.createEmptyRepo = function(req) {
	return common.initRepo(req, {}, callback);
}

common.createSmallRepo = function(req) {
	return common.createEmptyRepo(req).then(function(dir) {
		var testFile = 'smalltestfile.txt';
    return common.post(req, '/testing/createfile', { file: path.join(dir, testFile) })
      .then(function() {
        return common.post(req, '/commit', { path: dir, message: 'Init', files: [{ name: testFile }] });
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
