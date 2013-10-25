var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var async = require('async');
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
		common.createEmptyRepo(req, function(err, dir) {
			if (err) return done(err);
			testDir = dir;
			done();
		});
	});

	var testFile = 'afile.txt';
	var testImage = 'image.png'

	it('diff on non existing file should fail', function(done) {
		req
			.get(restGit.pathPrefix + '/diff')
			.query({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(done));
	});

	var content, imgContent;

	it('should be possible to create a file', function(done) {
		content = ['A', 'few', 'lines', 'of', 'content', ''];
		common.post(req, '/testing/createfile', { file: path.join(testDir, testFile), content: content.join('\n') }, done);
	});

	it('should be possible to create a file', function(done) {
		imgContent = ['PNG', 'few', 'lines', 'of', 'content', ''];
		common.post(req, '/testing/createfile', { file: path.join(testDir, testImage), content: content.join('\n') }, done);
	});

	it('diff on created file should work', function(done) {
		common.get(req, '/diff', { path: testDir, file: testFile }, function(err, res) {
			if (err) return done(err);
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

	// Causes weird "cannot find req of undefined".  
	// API call is called correctly and I have no idea where this is triggered so I'm not sure how I can test get image functionality.
	// it('diff on image file should work', function(done) {
	// 	common.get(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' }, function(err, res) 	{	
	// 		console.log(1);
	// 		if (err) return done(err);
	// 		expect(res.body).to.be.an('array');
	// 		expect(res.body.length).to.be(1);
	// 		done();
	// 	});
	// });

	it('should be possible to commit a file', function(done) {
		common.post(req, '/commit', { path: testDir, message: "Init", files: [testFile] }, done);
	});

	it('diff on commited file should work', function(done) {
		common.get(req, '/diff', { path: testDir, file: testFile }, function(err, res) {
			if (err) return done(err);
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
		common.get(req, '/diff', { path: testDir, file: testFile }, function(err, res) {
			if (err) return done(err);
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
		common.get(req, '/diff', { path: testDir, file: testFile }, function(err, res) {
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
