var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var async = require('async');
var fs = require('fs');
var path = require('path');
var restGit = require('../source/git-api');
var common = require('./common.js');
var wrapErrorHandler = common.wrapErrorHandler;

var app = express();
app.use(require('body-parser')());

restGit.registerApi({ app: app, config: { dev: true } });

var testDir;

var req = request(app);

describe('git-api conflict rebase', function () {

	this.timeout(8000);

	var testFile1 = "testfile1.txt";

	before(function(done) {
		common.createSmallRepo(req, function(err, dir) {
			if (err) return done(err);
			testDir = dir;

			async.series([
				function(done) { common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) }, done); }
			], done);
		});
	});

	it('should be possible to stash', function(done) {
		common.post(req, '/stashes', { path: testDir }, done);
	});

	it('stashes should list the stashed item', function(done) {
		common.get(req, '/stashes', { path: testDir }, function(err, res) {
			if (err) return done(err);
			expect(res.body.length).to.be(1);
			expect(res.body[0].id).to.be(0);
			expect(res.body[0].name).to.be('stash@{0}');
			done();
		});
	});

	it('should be possible to drop stash', function(done) {
		common.delete(req, '/stashes/0', { path: testDir }, done);
	});

})
