var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var restGit = require('../src/git-api');
var common = require('./common.js');

var app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

var testDir;

var req = request(app);

describe('git-api conflict rebase', function () {

	this.timeout(8000);

	var testFile1 = "testfile1.txt";

	before(function(done) {
		common.createSmallRepo(req).then(function(dir) {
			testDir = dir;

			return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) });
		}).then(function() { done(); }).catch(done);
	});

	it('should be possible to stash', function(done) {
		common.post(req, '/stashes', { path: testDir })
      .then(function() { done(); }).catch(done);
	});

	it('stashes should list the stashed item', function(done) {
		common.get(req, '/stashes', { path: testDir }, function(res) {
			expect(res.body.length).to.be(1);
			expect(res.body[0].reflogId).to.be('0');
			expect(res.body[0].reflogName).to.be('stash@{0}');
		}).then(function() { done(); }).catch(done);
	});

	it('should be possible to drop stash', function(done) {
		common.delete(req, '/stashes/0', { path: testDir })
      .then(function() { done(); }).catch(done);
	});

	after(function(done) {
		common.post(req, '/testing/cleanup', undefined)
      .then(function() { done(); }).catch(done);
	});

});
