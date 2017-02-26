var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var restGit = require('../src/git-api');
var common = require('./common.js');

var app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true, autoStashAndPop: false } });

var testDir;

var req = request(app);


describe('git-api conflict checkout no auto stash', function () {

	this.timeout(8000);

	var testBranch = 'testBranch';
	var testFile1 = "testfile1.txt";

	before(function(done) {
		common.createEmptyRepo(req).then(function(dir) {
			testDir = dir;
			return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) })
        .then(common.post(req, '/commit', { path: testDir, message: 'a', files: [{ name: testFile1 }] })
        .then(common.post(req, '/branches', { path: testDir, name: testBranch, startPoint: 'master' })
				.then(common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) })
		}).then(function() { done(); }).catch(done);
	});

	it('should be possible to make some changes', function(done) {
		common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) })
      .then(function() { done(); }).catch(done);
	});

	it('should not be possible to checkout with local files that will conflict', function(done) {
		req
			.post(restGit.pathPrefix + '/checkout')
			.send({ path: testDir, name: testBranch })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.then(function(res) {
				expect(res.body.errorCode).to.be('local-changes-would-be-overwritten');
			}).then(function() { done(); }).catch(done);
	});

	it('checkout should say we are still on master', function(done) {
		common.get(req, '/checkout', { path: testDir }).then(function(res) {
			expect(res.body).to.be('master');
		}).then(function() { done(); }).catch(done);
	});

	after(function(done) {
		common.post(req, '/testing/cleanup', undefined)
      .then(function() { done(); }).catch(done);
	});

});
