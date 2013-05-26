
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

var testDirLocal, testDirRemote;
var gitConfig;

var req = request(app);

describe('git-api remote', function () {


	it('creating test dirs should work', function(done) {
		async.parallel([
			function(done) {
				common.post(req, '/testing/createdir', undefined, done, function(err, res) {
					expect(res.body.path).to.be.ok();
					testDirLocal = res.body.path;
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

	it('init "remote" test dir should work', function(done) {
		common.post(req, '/init', { path: testDirRemote }, done);
	});

	it('creating a commit in "remote" repo should work', function(done) {
		var testFile = path.join(testDirRemote, "testfile1.txt");
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: testFile }, done); },
			function(done) { common.post(req, '/commit', { path: testDirRemote, message: "Init", files: [testFile] }, done); }
		], done);
	});

	it('cloning "remote" test dir should work', function(done) {
		common.post(req, '/clone', { path: testDirLocal, remote: testDirRemote }, done);
	});

	it('log in "local" should show the init commit', function(done) {
		common.get(req, '/log', { path: testDirLocal }, done, function(err, res) {
			expect(res.body).to.be.a('array');
			expect(res.body.length).to.be(1);
			var init = res.body[0];
			expect(init.message).to.be('Init');
			done();
		});
	});

	it('creating a commit in "remote" repo should work', function(done) {
		var testFile = path.join(testDirRemote, "testfile2.txt");
		async.series([
			function(done) { common.post(req, '/testing/createfile', { file: testFile }, done); },
			function(done) { common.post(req, '/commit', { path: testDirRemote, message: "Commit2", files: [testFile] }, done); }
		], done);
	});

	it('fetching in "local" should work', function(done) {
		common.post(req, '/fetch', { path: testDirLocal }, done);
	});

	it('log in "local" should show remote as one step ahead', function(done) {
		common.get(req, '/log', { path: testDirLocal }, done, function(err, res) {
			expect(res.body).to.be.a('array');
			expect(res.body.length).to.be(2);
			var init = _.find(res.body, function(node) { return node.title == 'Init'; });
			var commit2 = _.find(res.body, function(node) { return node.title == 'Commit2'; });
			expect(init).to.be.ok();
			expect(commit2).to.be.ok();
			expect(init.refs).to.eql(['HEAD', 'refs/heads/master']);
			expect(commit2.refs).to.eql(['refs/remotes/origin/master', 'refs/remotes/origin/HEAD']);
			done();
		});
	});

	it('rebasing local master onto remote master should work in "local"', function(done) {
		common.post(req, '/rebase', { path: testDirLocal, onto: 'origin/master' }, done);
	});

	it('log in "local" should show the repos as in sync', function(done) {
		common.get(req, '/log', { path: testDirLocal }, done, function(err, res) {
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

	it('cleaning up test dir should work', function(done) {
		req
			.post(restGit.pathPrefix + '/testing/cleanup')
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});
});