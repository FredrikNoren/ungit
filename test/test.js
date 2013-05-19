
var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var restGit = require('../rest-git');

var app = express();

restGit.registerApi(app, null, true);

var testDir;
var gitConfig;

describe('git', function () {

	it('creating test dir should work', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/testing/createdir')
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body.path).to.be.ok();
				testDir = res.body.path;
				done();
			});
	});

	it('config should return config data', function(done) {
		request(app)
			.get(restGit.pathPrefix + '/config')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body.config).to.be.an('object');
				expect(res.body.config['user.name']).to.be.ok();
				expect(res.body.config['user.email']).to.be.ok();
				gitConfig = res.body.config;
				done();
			});
	});


	it('status should say uninited in uninited directory', function(done) {
		request(app)
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body.inited).to.be(false);
				done();
			});
	});

	it('status should fail in non-existing directory', function(done) {
		request(app)
			.get(restGit.pathPrefix + '/status')
			.query({ path: path.join(testDir, 'nowhere') })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400, done);
	});

	it('init should succeed in uninited directory', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/init')
			.send({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});

	it('status should succeed in inited directory', function(done) {
		request(app)
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body.inited).to.be(true);
				expect(res.body.branch).to.be('master');
				done();
			});
	});

	it('commit should fail on when there\'s no files to commit', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/commit')
			.send({ path: testDir, message: 'test' })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400, done);
	});

	var testFile = 'somefile';

	it('log should be empty before first commit', function(done) {
		request(app)
			.get(restGit.pathPrefix + '/log')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body.entries).to.be.a('array');
				expect(res.body.entries.length).to.be(0);
				done();
			});
	});

	it('stage should fail on non-existing file', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/stage')
			.send({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400, done);
	});

	it('creating test file should work', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/testing/createfile')
			.send({ file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});

	it('status should list untracked file', function(done) {
		request(app)
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body.files).to.be.a('array');
				expect(res.body.files.length).to.be(1);
				expect(res.body.files[0]).to.eql({
					name: testFile,
					status: 'untracked'
				});
				done();
			});
	});

	it('stage should succeed on existing file', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/stage')
			.send({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});

	it('status should list staged file', function(done) {
		request(app)
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body.files).to.be.a('array');
				expect(res.body.files.length).to.be(1);
				expect(res.body.files[0]).to.eql({
					name: testFile,
					status: 'staged new'
				});
				done();
			});
	});

	it('unstage should succeed on staged file', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/unstage')
			.send({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});

	it('stage should succeed on unstaged file', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/stage')
			.send({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});

	var commitMessage = 'test';

	it('commit should fail without commit message', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/commit')
			.send({ path: testDir, message: undefined })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400, done);
	});

	it('commit should succeed on when there\'s files to commit', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/commit')
			.send({ path: testDir, message: commitMessage })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});

	it('log should show latest commit', function(done) {
		request(app)
			.get(restGit.pathPrefix + '/log')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body.entries).to.be.a('array');
				expect(res.body.entries.length).to.be(1);
				expect(res.body.entries[0].message).to.be(commitMessage);
				expect(res.body.entries[0].title).to.be(commitMessage);
				expect(res.body.entries[0].authorName).to.be(gitConfig['user.name']);
				expect(res.body.entries[0].authorEmail).to.be(gitConfig['user.email']);
				done();
			});
	});

	it('modifying a test file should work', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/testing/changefile')
			.send({ file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});

	it('modified file should show up in status', function(done) {
		request(app)
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body.files).to.be.a('array');
				expect(res.body.files.length).to.be(1);
				expect(res.body.files[0]).to.eql({
					name: testFile,
					status: 'modified'
				});
				done();
			});
	});

	it('discarding changes should work', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/discardchanges')
			.send({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});

	var testFile2 = 'my test.txt';

	it('creating a multi word test file should work', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/testing/createfile')
			.send({ file: testFile2 })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});

	it('status should list the new file', function(done) {
		request(app)
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body.files).to.be.a('array');
				expect(res.body.files.length).to.be(1);
				expect(res.body.files[0]).to.eql({
					name: testFile2,
					status: 'untracked'
				});
				done();
			});
	});

	it('discarding the new file should work', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/discardchanges')
			.send({ path: testDir, file: testFile2 })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});


	it('removing test dir should work', function(done) {
		request(app)
			.post(restGit.pathPrefix + '/testing/removedir')
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	})


})
