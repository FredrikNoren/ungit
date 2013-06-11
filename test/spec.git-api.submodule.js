
var expect = require('expect.js');
var request = require('supertest');
var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var path = require('path');
var async = require('async');
var child_process = require('child_process');
var async = require('async');
var restGit = require('../git-api');
var common = require('./common.js');
var wrapErrorHandler = common.wrapErrorHandler;

var app = express();

restGit.registerApi(app, null, true);

var req = request(app);

describe('git-api submodule', function () {

	this.timeout(8000);

	var testDirMain, testDirSecondary;

	before(function(done) {
		// Set up two directories and init them and add some content
		async.parallel([
			function(done) {
				common.createSmallRepo(req, done, function(dir) {
					testDirMain = dir;
					done();
				});
			},
			function(done) {
				common.createSmallRepo(req, done, function(dir) {
					testDirSecondary = dir;
					done();
				});
			}
		], done);
	});

	var submodulePath = 'sub';

	it('submodule add should work', function(done) {
		common.post(req, '/submodules', { path: testDirMain, submodulePath: submodulePath, submoduleUrl: testDirSecondary }, done);
	});

	it('submodule should show up in status', function(done) {
		common.get(req, '/status', { path: testDirMain }, done, function(err, res) {
			expect(Object.keys(res.body.files).length).to.be(2);
			expect(res.body.files[submodulePath]).to.eql({
				isNew: true,
				staged: true,
				removed: false
			});
			expect(res.body.files['.gitmodules']).to.eql({
				isNew: true,
				staged: true,
				removed: false
			});
			done();
		});
	});

	it('commit should succeed', function(done) {
		common.post(req, '/commit', { path: testDirMain, message: 'Add submodule', files: [submodulePath, '.gitmodules'] }, done);
	});

	it('status should be empty after commit', function(done) {
		common.get(req, '/status', { path: testDirMain }, done, function(err, res) {
			expect(Object.keys(res.body.files).length).to.be(0);
			done();
		});
	});

	after(function(done) {
		common.post(req, '/testing/cleanup', undefined, done);
	});

});