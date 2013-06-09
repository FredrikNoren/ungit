
var expect = require('expect.js');
var request = require('supertest');
var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var async = require('async');
var restGit = require('../git-api');
var common = require('./common.js');
var wrapErrorHandler = common.wrapErrorHandler;

var app = express();

restGit.registerApi(app, null, true);

var testDirLocal1, testDirLocal2, testDirRemote;
var gitConfig;

var req = request(app);

describe('git-api remote', function () {


	it('creating test dirs should work', function(done) {
		async.parallel([
			function(done) {
				common.post(req, '/testing/createdir', undefined, done, function(err, res) {
					expect(res.body.path).to.be.ok();
					testDirLocal1 = res.body.path;
					done();
				});
			},
			function(done) {
				common.post(req, '/testing/createdir', undefined, done, function(err, res) {
					expect(res.body.path).to.be.ok();
					testDirLocal2 = res.body.path;
					done();
				});
			},
			function(done) {
				common.post(req, '/testing/createdir', undefined, done, function(err, res) {
					expect(res.body.path).to.be.ok();
					testDirRemote = res.body.path;
					done();
				});
			},
		], done);
	});

	it('init a bare "remote" test dir should work', function(done) {
		common.post(req, '/init', { path: testDirRemote, bare: true }, done);
	});

	it('remotes in no-remotes-repo should be zero', function(done) {
		common.get(req, '/remotes', { path: testDirRemote }, done, function(err, res) {
			expect(res.body.length).to.be(0);
			done();
		});
	});

	it('cloning "remote" to "local1" should work', function(done) {
		common.post(req, '/clone', { path: testDirLocal1, url: testDirRemote, destinationDir: '.' }, done);
	});

	it('remotes in cloned-repo should be one', function(done) {
		common.get(req, '/remotes', { path: testDirLocal1 }, done, function(err, res) {
			expect(res.body.length).to.be(1);
			expect(res.body[0]).to.be('origin');
			done();
		});
	});

	it('creating a commit in "local1" repo should work', function(done) {
		var testFile = path.join(testDirLocal1, "testfile1.txt");
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: testFile }, done); },
			function(done) { common.post(req, '/commit', { path: testDirLocal1, message: "Init", files: [testFile] }, done); }
		], done);
	});

	it('log in "local1" should show the init commit', function(done) {
		common.get(req, '/log', { path: testDirLocal1 }, done, function(err, res) {
			expect(res.body).to.be.a('array');
			expect(res.body.length).to.be(1);
			var init = res.body[0];
			expect(init.message.indexOf('Init')).to.be(0);
			expect(init.refs).to.contain('HEAD');
			expect(init.refs).to.contain('refs/heads/master');
			done();
		});
	});

	it('pushing form "local1" to "remote" should work', function(done) {
		common.post(req, '/push', { path: testDirLocal1 }, done);
	});

	it('cloning "remote" to "local2" should work', function(done) {
		common.post(req, '/clone', { path: testDirLocal2, url: testDirRemote, destinationDir: '.' }, done);
	});

	it('log in "local2" should show the init commit', function(done) {
		common.get(req, '/log', { path: testDirLocal2 }, done, function(err, res) {
			expect(res.body).to.be.a('array');
			expect(res.body.length).to.be(1);
			var init = res.body[0];
			expect(init.message.indexOf('Init')).to.be(0);
			expect(init.refs).to.contain('HEAD');
			expect(init.refs).to.contain('refs/heads/master');
			expect(init.refs).to.contain('refs/remotes/origin/master');
			expect(init.refs).to.contain('refs/remotes/origin/HEAD');
			done();
		});
	});

	it('creating and pushing a commit in "local1" repo should work', function(done) {
		var testFile = path.join(testDirLocal1, "testfile2.txt");
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: testFile }, done); },
			function(done) { common.post(req, '/commit', { path: testDirLocal1, message: "Commit2", files: [testFile] }, done); },
			function(done) { common.post(req, '/push', { path: testDirLocal1 }, done); }
		], done);
	});

	it('fetching in "local2" should work', function(done) {
		common.post(req, '/fetch', { path: testDirLocal2 }, done);
	});

	it('log in "local2" should show the branch as one behind', function(done) {
		common.get(req, '/log', { path: testDirLocal2 }, done, function(err, res) {
			expect(res.body).to.be.a('array');
			expect(res.body.length).to.be(2);
			var init = _.find(res.body, function(node) { return node.title == 'Init'; });
			var commit2 = _.find(res.body, function(node) { return node.title == 'Commit2'; });
			expect(init).to.be.ok();
			expect(commit2).to.be.ok();
			expect(init.refs).to.contain('HEAD');
			expect(init.refs).to.contain('refs/heads/master');
			expect(commit2.refs).to.contain('refs/remotes/origin/master');
			expect(commit2.refs).to.contain('refs/remotes/origin/HEAD');
			done();
		});
	});

	it('rebasing local master onto remote master should work in "local2"', function(done) {
		common.post(req, '/rebase', { path: testDirLocal2, onto: 'origin/master' }, done);
	});

	it('log in "local2" should show the branch as in sync', function(done) {
		common.get(req, '/log', { path: testDirLocal2 }, done, function(err, res) {
			expect(res.body).to.be.a('array');
			expect(res.body.length).to.be(2);
			var init = _.find(res.body, function(node) { return node.title == 'Init'; });
			var commit2 = _.find(res.body, function(node) { return node.title == 'Commit2'; });
			expect(init).to.be.ok();
			expect(commit2).to.be.ok();
			expect(init.refs).to.eql([]);
			expect(commit2.refs).to.contain('HEAD');
			expect(commit2.refs).to.contain('refs/heads/master');
			expect(commit2.refs).to.contain('refs/remotes/origin/master');
			expect(commit2.refs).to.contain('refs/remotes/origin/HEAD');
			done();
		});
	});

	it('creating a commit in "local2" repo should work', function(done) {
		var testFile = path.join(testDirLocal2, "testfile3.txt");
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: testFile }, done); },
			function(done) { common.post(req, '/commit', { path: testDirLocal2, message: "Commit3", files: [testFile] }, done); }
		], done);
	});

	it('resetting local master to remote master should work in "local2"', function(done) {
		common.post(req, '/reset', { path: testDirLocal2, to: 'origin/master' }, done);
	});

	it('log in "local2" should show the branch as in sync', function(done) {
		common.get(req, '/log', { path: testDirLocal2 }, done, function(err, res) {
			expect(res.body.length).to.be(2);
			var init = _.find(res.body, function(node) { return node.title == 'Init'; });
			var commit2 = _.find(res.body, function(node) { return node.title == 'Commit2'; });
			expect(init.refs).to.eql([]);
			expect(commit2.refs).to.contain('HEAD');
			expect(commit2.refs).to.contain('refs/heads/master');
			expect(commit2.refs).to.contain('refs/remotes/origin/master');
			expect(commit2.refs).to.contain('refs/remotes/origin/HEAD');
			done();
		});
	});

	it('status should show nothing', function(done) {
		common.get(req, '/status', { path: testDirLocal2 }, done, function(err, res) {
			expect(Object.keys(res.body.files).length).to.be(0);
			done();
		});
	});
	
	it('cleaning up test dir should work', function(done) {
		req
			.post(restGit.pathPrefix + '/testing/cleanup')
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});
});