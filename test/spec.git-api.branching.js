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
var gitConfig;

var req = request(app);

describe('git-api branching', function () {

	this.timeout(8000);

	before(function(done) {
		common.createEmptyRepo(req, function(err, dir) {
			if (err) return done(err);
			testDir = dir;
			common.get(req, '/gitconfig', { path: testDir }, function(err, res) {
				if (err) return done(err);
				gitConfig = res.body;
				done();
			});
		});
	});

	var commitMessage = 'Commit 1';

	var testFile1 = "testfile1.txt";

	it('should be possible to commit to master', function(done) {
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) }, done); },
			function(done) { common.post(req, '/commit', { path: testDir, message: commitMessage, files: [testFile1] }, done); }
		], done);
	});

	it('listing branches should work', function(done) {
		common.get(req, '/branches', { path: testDir }, function(err, res) {
			if (err) return done(err);
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
		common.get(req, '/branches', { path: testDir }, function(err, res) {
			if (err) return done(err);
			expect(res.body.length).to.be(2);
			expect(res.body[0].name).to.be('master');
			expect(res.body[0].current).to.be(true);
			expect(res.body[1].name).to.be(testBranch);
			expect(res.body[1].current).to.be(undefined);
			done();
		});
	});

	it('should be possible to switch to a branch', function(done) {
		common.post(req, '/checkout', { path: testDir, name: testBranch }, done);
	});

	it('listing branches should show the new branch as current', function(done) {
		common.get(req, '/branches', { path: testDir }, function(err, res) {
			if (err) return done(err);
			expect(res.body.length).to.be(2);
			expect(res.body[0].name).to.be('master');
			expect(res.body[0].current).to.be(undefined);
			expect(res.body[1].name).to.be(testBranch);
			expect(res.body[1].current).to.be(true);
			done();
		});
	});

	it('get branch should show the new branch as current', function(done) {
		common.get(req, '/checkout', { path: testDir }, function(err, res) {
			if (err) return done(err);
			expect(res.body).to.be(testBranch);
			done();
		});
	});

	var commitMessage3 = 'Commit 3';
	var testFile2 = "testfile2.txt";

	it('should be possible to commit to the branch', function(done) {
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: path.join(testDir, testFile2) }, done); },
			function(done) { common.post(req, '/commit', { path: testDir, message: commitMessage3, files: [testFile2] }, done); }
		], done);
	});

	it('log should show both branches and all commits', function(done) {
		common.get(req, '/log', { path: testDir }, function(err, res) {
			if (err) return done(err);
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

	it('should be possible to modify some local file', function(done) {
		common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }, done);
	});

	it('should be possible to checkout another branch with local modifications', function(done) {
		common.post(req, '/checkout', { path: testDir, name: 'master' }, done);
	});

	it('status should list the changed file', function(done) {
		common.get(req, '/status', { path: testDir }, function(err, res) {
			if (err) return done(err);
			expect(Object.keys(res.body.files).length).to.be(1);
			expect(res.body.files[testFile1]).to.eql({
				isNew: false,
				staged: false,
				removed: false,
				conflict: false,
				type: 'text'
			});
			done();
		});
	});


	it('should be possible to create a tag', function(done) {
		common.post(req, '/tags', { path: testDir, name: 'v1.0' }, done);
	});

	it('should be possible to list tag', function(done) {
		common.get(req, '/tags', { path: testDir }, function(err, res) {
			if (err) return done(err);
			expect(res.body.length).to.be(1);
			done();
		});
	});

	it('should be possible to delete a tag', function(done) {
		common.delete(req, '/tags', { path: testDir, name: 'v1.0' }, done);
	});

	it('tag should be removed', function(done) {
		common.get(req, '/tags', { path: testDir }, function(err, res) {
			if (err) return done(err);
			expect(res.body.length).to.be(0);
			done();
		});
	});

	it('should be possible to delete a branch', function(done) {
		common.delete(req, '/branches', { path: testDir, name: testBranch }, done);
	});

	it('branch should be removed', function(done) {
		common.get(req, '/branches', { path: testDir }, function(err, res) {
			if (err) return done(err);
			expect(res.body.length).to.be(1);
			done();
		});
	});

})
