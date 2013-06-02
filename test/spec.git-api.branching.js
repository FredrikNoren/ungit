var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var restGit = require('../git-api');
var common = require('./common.js');
var wrapErrorHandler = common.wrapErrorHandler;

var app = express();

restGit.registerApi(app, null, true);

var testDir;
var gitConfig;

var req = request(app);

describe('git-api branching', function () {

	before(function(done) {
		common.createEmptyRepo(req, done, function(dir) {
			testDir = dir;
			common.get(req, '/config', { path: testDir }, done, function(err, res) {
				gitConfig = res.body;
				done();
			});
		});
	});

	var commitMessage = 'Commit 1';

	it('should be possible to commit to master', function(done) {
		var testFile = path.join(testDir, "testfile5.txt");
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: testFile }, done); },
			function(done) { common.post(req, '/commit', { path: testDir, message: commitMessage, files: [testFile] }, done); }
		], done);
	});

	it('listing branches should work', function(done) {
		common.get(req, '/branches', { path: testDir }, done, function(err, res) {
			expect(res.body.length).to.be(1);
			expect(res.body[0].name).to.be('master');
			expect(res.body[0].current).to.be(true);
			done();
		});
	});

	var testBranch = 'testBranch';

	it('creating a branch should work', function(done) {
		common.post(req, '/branches', { path: testDir, name: testBranch, startPoint: 'master' }, done);
	});

	it('listing branches should show the new branch', function(done) {
		common.get(req, '/branches', { path: testDir }, done, function(err, res) {
			expect(res.body.length).to.be(2);
			expect(res.body[0].name).to.be('master');
			expect(res.body[0].current).to.be(true);
			expect(res.body[1].name).to.be(testBranch);
			expect(res.body[1].current).to.be(undefined);
			done();
		});
	});

	it('should be possible to switch to a branch', function(done) {
		common.post(req, '/branch', { path: testDir, name: testBranch }, done);
	});

	it('listing branches should show the new branch as current', function(done) {
		common.get(req, '/branches', { path: testDir }, done, function(err, res) {
			expect(res.body.length).to.be(2);
			expect(res.body[0].name).to.be('master');
			expect(res.body[0].current).to.be(undefined);
			expect(res.body[1].name).to.be(testBranch);
			expect(res.body[1].current).to.be(true);
			done();
		});
	});

	it('get branch should show the new branch as current', function(done) {
		common.get(req, '/branch', { path: testDir }, done, function(err, res) {
			expect(res.body).to.be(testBranch);
			done();
		});
	});

	var commitMessage3 = 'Commit 3';

	it('should be possible to commit to the branch', function(done) {
		var testFile = path.join(testDir, "testfile1.txt");
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: testFile }, done); },
			function(done) { common.post(req, '/commit', { path: testDir, message: commitMessage3, files: [testFile] }, done); }
		], done);
	});

	it('log should show both branches and all commits', function(done) {
		common.get(req, '/log', { path: testDir }, done, function(err, res) {
			expect(res.body).to.be.a('array');
			expect(res.body.length).to.be(2);
			var objs = {};
			res.body.forEach(function(obj) {
				obj.refs.sort();
				objs[obj.refs[0]] = obj;
			});
			var master = objs['refs/heads/master'];
			var HEAD = objs['HEAD'];
			expect(master.message.indexOf(commitMessage)).to.be(0);
			expect(master.title).to.be(commitMessage);
			expect(master.authorDate).to.be.a('string');
			expect(master.authorName).to.be(gitConfig['user.name']);
			expect(master.authorEmail).to.be(gitConfig['user.email']);
			expect(master.commitDate).to.be.a('string');
			expect(master.committerName).to.be(gitConfig['user.name']);
			expect(master.committerEmail).to.be(gitConfig['user.email']);
			expect(master.refs).to.eql(['refs/heads/master']);
			expect(master.parents).to.eql([]);
			expect(master.sha1).to.be.ok();

			expect(HEAD.message.indexOf(commitMessage3)).to.be(0);
			expect(HEAD.title).to.be(commitMessage3);
			expect(HEAD.authorDate).to.be.a('string');
			expect(HEAD.authorName).to.be(gitConfig['user.name']);
			expect(HEAD.authorEmail).to.be(gitConfig['user.email']);
			expect(HEAD.commitDate).to.be.a('string');
			expect(HEAD.committerName).to.be(gitConfig['user.name']);
			expect(HEAD.committerEmail).to.be(gitConfig['user.email']);
			expect(HEAD.refs).to.eql(['HEAD', 'refs/heads/' + testBranch]);
			expect(HEAD.parents).to.eql([master.sha1]);
			expect(HEAD.sha1).to.be.ok();
			done();
		});
	});


})