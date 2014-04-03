
var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var async = require('async');
var restGit = require('../source/git-api');
var common = require('./common.js');
var wrapErrorHandler = common.wrapErrorHandler;

var app = express();
app.use(require('body-parser')());

restGit.registerApi({ app: app, config: { dev: true } });

var req = request(app);

describe('git-api submodule', function () {

	this.timeout(8000);

	var testDirMain, testDirSecondary;

	before(function(done) {
		// Set up two directories and init them and add some content
		async.parallel([
			common.createSmallRepo.bind(null, req),
			common.createSmallRepo.bind(null, req),
		], function(err, res) {
			if (err) return done(err);
			testDirMain = res[0];
			testDirSecondary = res[1];
			done();
		});
	});

	var submodulePath = 'sub';

	it('submodule add should work', function(done) {
		common.post(req, '/submodules', { path: testDirMain, submodulePath: submodulePath, submoduleUrl: testDirSecondary }, done);
	});

	it('submodule should show up in status', function(done) {
		common.get(req, '/status', { path: testDirMain }, function(err, res) {
			if (err) return done(err);
			expect(Object.keys(res.body.files).length).to.be(2);
			expect(res.body.files[submodulePath]).to.eql({
				isNew: true,
				staged: true,
				removed: false,
				conflict: false,
				type: 'text'
			});
			expect(res.body.files['.gitmodules']).to.eql({
				isNew: true,
				staged: true,
				removed: false,
				conflict: false,
				type: 'text'
			});
			done();
		});
	});

	it('commit should succeed', function(done) {
		common.post(req, '/commit', { path: testDirMain, message: 'Add submodule', files: [submodulePath, '.gitmodules'] }, done);
	});

	it('status should be empty after commit', function(done) {
		common.get(req, '/status', { path: testDirMain }, function(err, res) {
			if (err) return done(err);
			expect(Object.keys(res.body.files).length).to.be(0);
			done();
		});
	});

	var testFile = path.join(submodulePath, 'testy.txt');

	it('creating a test file in sub dir should work', function(done) {
		common.post(req, '/testing/createfile', { file: path.join(testDirMain, testFile) }, done);
	});

	it('submodule should show up in status when it\'s dirty', function(done) {
		common.get(req, '/status', { path: testDirMain }, function(err, res) {
			if (err) return done(err);
			expect(Object.keys(res.body.files).length).to.be(1);
			expect(res.body.files[submodulePath]).to.eql({
				isNew: false,
				staged: false,
				removed: false,
				conflict: false,
				type: 'text'
			});
			done();
		});
	});

	it('diff on submodule should work', function(done) {
		common.get(req, '/diff', { path: testDirMain, file: submodulePath }, function(err, res) {
			if (err) return done(err);
			expect(res.body).to.be.an('array');
			expect(res.body.length).to.be.greaterThan(0);
			expect(res.body[0].lines).to.be.an('array');
			expect(res.body[0].lines.length).to.be.greaterThan(0);
			done();
		});
	});

	after(function(done) {
		common.post(req, '/testing/cleanup', undefined, done);
	});

});
