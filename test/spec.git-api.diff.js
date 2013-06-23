var expect = require('expect.js');
var request = require('supertest');
var _ = require('underscore');
var express = require('express');
var fs = require('fs');
var path = require('path');
var async = require('async');
var child_process = require('child_process');
var async = require('async');
var restGit = require('../source/git-api');
var common = require('./common.js');
var wrapErrorHandler = common.wrapErrorHandler;

var app = express();

restGit.registerApi(app, null, null, { dev: true });

var req = request(app);

describe('git-api diff', function () {

	var testDir;

	before(function(done) {
		common.createEmptyRepo(req, done, function(dir) {
			testDir = dir;
			done();
		});
	});

	var testFile = 'afile.txt';

	it('diff on non existing file should fail', function(done) {
		req
			.get(restGit.pathPrefix + '/diff')
			.query({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(done));
	});

	var content;

	it('should be possible to create a file', function(done) {
		content = ['A', 'few', 'lines', 'of', 'content', ''];
		common.post(req, '/testing/createfile', { file: path.join(testDir, testFile), content: content.join('\n') }, done);
	});

	it('diff on created file should work', function(done) {
		common.get(req, '/diff', { path: testDir, file: testFile }, done, function(err, res) {
			expect(res.body).to.be.an('array');
			expect(res.body.length).to.be(1);
			expect(res.body[0].lines).to.be.an('array');
			expect(res.body[0].lines.length).to.be(content.length);
			for(var i = 0; i < res.body[0].lines.length; i++) {
				var contentLine = content[i];
				var diffLine = res.body[0].lines[i];
				expect(diffLine).to.eql([null, i, '+' + contentLine]);
			}
			done();
		});
	});

	it('should be possible to commit a file', function(done) {
		common.post(req, '/commit', { path: testDir, message: "Init", files: [testFile] }, done);
	});

	it('diff on commited file should work', function(done) {
		common.get(req, '/diff', { path: testDir, file: testFile }, done, function(err, res) {
			expect(res.body).to.be.an('array');
			expect(res.body.length).to.be(0);
			done();
		});
	});

	it('should be possible to modify a file', function(done) {
		content.splice(2, 0, 'more');
		common.post(req, '/testing/changefile', { file: path.join(testDir, testFile), content: content.join('\n') }, done);
	});

	it('diff on modified file should work', function(done) {
		common.get(req, '/diff', { path: testDir, file: testFile }, done, function(err, res) {
			expect(res.body).to.be.an('array');
			expect(res.body.length).to.be(1);
			expect(res.body[0].lines).to.be.an('array');
			expect(res.body[0].lines).to.eql([
				[ null, null, '@@ -1,5 +1,6 @@' ],
				[ 1, 1, ' A' ],
				[ 2, 2, ' few' ],
				[ null, 3, '+more' ],
				[ 3, 4, ' lines' ],
				[ 4, 5, ' of' ],
				[ 5, 6, ' content' ]
			]);
			done();
		});
	});

	it('should be possible to commit a file', function(done) {
		common.post(req, '/commit', { path: testDir, message: "Init", files: [testFile] }, done);
	});

	it('removing a test file should work', function(done) {
		common.post(req, '/testing/removefile', { file: path.join(testDir, testFile) }, done);
	});

	it('diff on removed file should work', function(done) {
		common.get(req, '/diff', { path: testDir, file: testFile }, done, function(err, res) {
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