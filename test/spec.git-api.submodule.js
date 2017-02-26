
var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var restGit = require('../src/git-api');
var common = require('./common.js');
var Bluebird = require('bluebird');

var app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

var req = request(app);

describe('git-api submodule', function () {

	this.timeout(8000);

	var testDirMain, testDirSecondary;

	before(function(done) {
		// Set up two directories and init them and add some content
		Bluebird.all([common.createSmallRepo(req), common.createSmallRepo(req)])
      .then(function(res) {
  			testDirMain = res[0];
  			testDirSecondary = res[1];
  		}).then(function() { done(); }).catch(done);
	});

	var submodulePath = 'sub';

	it('submodule add should work', function(done) {
		common.post(req, '/submodules/add', { path: testDirMain, submodulePath: submodulePath, submoduleUrl: testDirSecondary })
      .then(function() { done(); }).catch(done);
	});

	it('submodule should show up in status', function(done) {
		common.get(req, '/status', { path: testDirMain }).then(function(res) {
			expect(Object.keys(res.body.files).length).to.be(2);
			expect(res.body.files[submodulePath]).to.eql({
				displayName: submodulePath,
				isNew: true,
				staged: true,
				removed: false,
				conflict: false,
				renamed: false,
				type: 'text',
				additions: '1',
				deletions: '0'
			});
			expect(res.body.files['.gitmodules']).to.eql({
				displayName: '.gitmodules',
				isNew: true,
				staged: true,
				removed: false,
				conflict: false,
				renamed: false,
				type: 'text',
				additions: '3',
				deletions: '0'
			});
		}).then(function() { done(); }).catch(done);
	});

	it('commit should succeed', function(done) {
		common.post(req, '/commit', { path: testDirMain, message: 'Add submodule', files: [{ name: submodulePath }, { name: '.gitmodules' }] })
      .then(function() { done(); }).catch(done);
	});

	it('status should be empty after commit', function(done) {
		common.get(req, '/status', { path: testDirMain }).then(function(res) {
			expect(Object.keys(res.body.files).length).to.be(0);
		}).then(function() { done(); }).catch(done);
	});

	var testFile = path.join(submodulePath, 'testy.txt');

	it('creating a test file in sub dir should work', function(done) {
		common.post(req, '/testing/createfile', { file: path.join(testDirMain, testFile) })
      .then(function() { done(); }).catch(done);
	});

	it('submodule should show up in status when it\'s dirty', function(done) {
		common.get(req, '/status', { path: testDirMain }).then(function(res) {
			expect(Object.keys(res.body.files).length).to.be(1);
			expect(res.body.files[submodulePath]).to.eql({
				displayName: submodulePath,
				isNew: false,
				staged: false,
				removed: false,
				conflict: false,
				renamed: false,
				type: 'text',
				additions: '0',
				deletions: '0'
			});
		}).then(function() { done(); }).catch(done);
	});

	it('diff on submodule should work', function(done) {
		common.get(req, '/diff', { path: testDirMain, file: submodulePath }).then(function(res) {
			expect(res.body.indexOf('-Subproject commit')).to.be.above(-1);
			expect(res.body.indexOf('+Subproject commit')).to.be.above(-1);
		}).then(function() { done(); }).catch(done);
	});

	after(function(done) {
		common.post(req, '/testing/cleanup', undefined)
      .then(function() { done(); }).catch(done);
	});

});
