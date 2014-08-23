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
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true, autoStashAndPop: false } });

var testDir;

var req = request(app);


describe('git-api conflict checkout', function () {

	this.timeout(8000);

	var testBranch = 'testBranch';
	var testFile1 = "testfile1.txt";

	before(function(done) {
		common.createEmptyRepo(req, function(err, dir) {
			if (err) return done(err);
			testDir = dir;
			async.series([
				function(done) { common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) }, done); },
				function(done) { common.post(req, '/commit', { path: testDir, message: 'a', files: [testFile1] }, done); },
				function(done) { common.post(req, '/branches', { path: testDir, name: testBranch, startPoint: 'master' }, done); },
				function(done) { common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }, done); },
				function(done) { common.post(req, '/commit', { path: testDir, message: 'b', files: [testFile1] }, done); },
			], done);
		});
	});

	it('should be possible to make some changes', function(done) {
		common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }, done);
	});

	it('should not be possible to checkout with local files that will conflict', function(done) {
		req
			.post(restGit.pathPrefix + '/checkout')
			.send({ path: testDir, name: testBranch })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(function(err, res) {
				expect(res.body.errorCode).to.be('local-changes-would-be-overwritten');
				done();
			}));
	});

	it('checkout should say we are still on master', function(done) {
		common.get(req, '/checkout', { path: testDir }, function(err, res) {
			if (err) return done(err);
			expect(res.body).to.be('master');
			done();
		});
	});

});
