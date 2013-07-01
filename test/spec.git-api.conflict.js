var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var restGit = require('../source/git-api');
var common = require('./common.js');
var wrapErrorHandler = common.wrapErrorHandler;

var app = express();

restGit.registerApi(app, null, null, { dev: true });

var testDir;

var req = request(app);

describe('git-api conflict', function () {

	this.timeout(8000);

	before(function(done) {
		common.createEmptyRepo(req, done, function(dir) {
			testDir = dir;
			done();
		});
	});

	var commitMessage = 'Commit 1';

	var testFile1 = "testfile1.txt";

	it('should be possible to commit', function(done) {
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) }, done); },
			function(done) { common.post(req, '/commit', { path: testDir, message: commitMessage, files: [testFile1] }, done); }
		], done);
	});

	var testBranch = 'testBranch';

	it('should be possible to create a branch', function(done) {		
		common.post(req, '/branches', { path: testDir, name: testBranch, startPoint: 'master' }, done);
	});

	it('should be possible to commit again', function(done) {
		async.series([
			function(done) { common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }, done); },
			function(done) { common.post(req, '/commit', { path: testDir, message: commitMessage, files: [testFile1] }, done); }
		], done);
	});

	it('should be possible to checkout the previously created branch', function(done) {
		common.post(req, '/checkout', { path: testDir, name: testBranch }, done);
	});

	it('should be possible to commit again', function(done) {
		async.series([
			function(done) { common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }, done); },
			function(done) { common.post(req, '/commit', { path: testDir, message: commitMessage, files: [testFile1] }, done); }
		], done);
	});

	it('should be possible to rebase on master', function(done) {
		req
			.post(restGit.pathPrefix + '/rebase')
			.send({ path: testDir, onto: 'master' })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body.errorCode).to.be('merge-failed');
				done();
			}));
	});

	it('status should list files in conflict', function(done) {
		common.get(req, '/status', { path: testDir }, done, function(err, res) {
			expect(res.body.inRebase).to.be(true);
			expect(Object.keys(res.body.files).length).to.be(1);
			expect(res.body.files[testFile1]).to.eql({
				isNew: false,
				staged: false,
				removed: false,
				conflict: true
			});
			done();
		});
	});

	it('should be possible fix the conflict', function(done) {
		common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }, done);
	});

	it('should be possible to resolve', function(done) {
		common.post(req, '/resolveconflicts', { path: testDir, files: [testFile1] }, done);
	});

	it('should be possible continue the rebase', function(done) {
		common.post(req, '/rebase/continue', { path: testDir }, done);
	});

})