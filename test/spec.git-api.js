
var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var restGit = require('../git-api');

var app = express();

restGit.registerApi(app, null, true);

var testDir;
var gitConfig;

var req = request(app);

var wrapErrorHandler = function(done, callback) {
	return function(err, res) {
		if (err) {
			console.dir(err);
			console.dir(res.body);
			done(err, res);
		} else if (callback) {
			callback(err, res);
		} else {
			done(err, res);
		}
	}
}

describe('git', function () {

	it('creating test dir should work', function(done) {
		req
			.post(restGit.pathPrefix + '/testing/createdir')
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body.path).to.be.ok();
				testDir = res.body.path;
				done();
			}));
	});

	it('config should return config data', function(done) {
		req
			.get(restGit.pathPrefix + '/config')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body).to.be.an('object');
				expect(res.body['user.name']).to.be.ok();
				expect(res.body['user.email']).to.be.ok();
				gitConfig = res.body;
				done();
			}));
	});


	it('status should fail in uninited directory', function(done) {
		req
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body.errorCode).to.be('not-a-repository');
				done();
			}));
	});

	it('status should fail in non-existing directory', function(done) {
		req
			.get(restGit.pathPrefix + '/status')
			.query({ path: path.join(testDir, 'nowhere') })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(done));
	});

	it('init should succeed in uninited directory', function(done) {
		req
			.post(restGit.pathPrefix + '/init')
			.send({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	it('status should succeed in inited directory', function(done) {
		req
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body.branch).to.be('master');
				done();
			}));
	});

	it('commit should fail on when there\'s no files to commit', function(done) {
		req
			.post(restGit.pathPrefix + '/commit')
			.send({ path: testDir, message: 'test', files: [] })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(done));
	});

	var testFile = 'somefile';

	it('log should be empty before first commit', function(done) {
		req
			.get(restGit.pathPrefix + '/log')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body).to.be.a('array');
				expect(res.body.length).to.be(0);
				done();
			}));
	});

	it('commit should fail on non-existing file', function(done) {
		req
			.post(restGit.pathPrefix + '/commit')
			.send({ path: testDir, message: 'test', files: [testFile] })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(done));
	});

	it('creating test file should work', function(done) {
		req
			.post(restGit.pathPrefix + '/testing/createfile')
			.send({ file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	it('status should list untracked file', function(done) {
		req
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(Object.keys(res.body.files).length).to.be(1);
				expect(res.body.files[testFile]).to.eql({
					isNew: true,
					staged: false
				});
				done();
			}));
	});

	it('diff on created file should work', function(done) {
		req
			.get(restGit.pathPrefix + '/diff')
			.query({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body).to.be.an('array');
				expect(res.body.length).to.be.greaterThan(0);
				expect(res.body[0].lines).to.be.an('array');
				expect(res.body[0].lines.length).to.be.greaterThan(0);
				done();
			}));
	});

	it('diff on non existing file should fail', function(done) {
		req
			.get(restGit.pathPrefix + '/diff')
			.query({ path: testDir, file: 'non-file.txt' })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(done));
	});


	var commitMessage = 'test';

	it('commit should fail without commit message', function(done) {
		req
			.post(restGit.pathPrefix + '/commit')
			.send({ path: testDir, message: undefined, files: [testFile] })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(done));
	});

	it('commit should succeed when there\'s files to commit', function(done) {
		req
			.post(restGit.pathPrefix + '/commit')
			.send({ path: testDir, message: commitMessage, files: [testFile] })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	it('log should show latest commit', function(done) {
		req
			.get(restGit.pathPrefix + '/log')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body).to.be.a('array');
				expect(res.body.length).to.be(1);
				expect(res.body[0].message).to.be(commitMessage);
				expect(res.body[0].title).to.be(commitMessage);
				expect(res.body[0].authorName).to.be(gitConfig['user.name']);
				expect(res.body[0].authorEmail).to.be(gitConfig['user.email']);
				done();
			}));
	});

	it('modifying a test file should work', function(done) {
		req
			.post(restGit.pathPrefix + '/testing/changefile')
			.send({ file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	it('modified file should show up in status', function(done) {
		req
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(Object.keys(res.body.files).length).to.be(1);
				expect(res.body.files[testFile]).to.eql({
					isNew: false,
					staged: false
				});
				done();
			}));
	});

	it('diff on modified file should work', function(done) {
		req
			.get(restGit.pathPrefix + '/diff')
			.query({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body).to.be.an('array');
				expect(res.body.length).to.be.greaterThan(0);
				expect(res.body[0].lines).to.be.an('array');
				expect(res.body[0].lines.length).to.be.greaterThan(0);
				done();
			}));
	});

	it('discarding changes should work', function(done) {
		req
			.post(restGit.pathPrefix + '/discardchanges')
			.send({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	var testFile2 = 'my test.txt';

	it('creating a multi word test file should work', function(done) {
		req
			.post(restGit.pathPrefix + '/testing/createfile')
			.send({ file: testFile2 })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	it('status should list the new file', function(done) {
		req
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(Object.keys(res.body.files).length).to.be(1);
				expect(res.body.files[testFile2]).to.eql({
					isNew: true,
					staged: false
				});
				done();
			}));
	});

	it('discarding the new file should work', function(done) {
		req
			.post(restGit.pathPrefix + '/discardchanges')
			.send({ path: testDir, file: testFile2 })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	it('listing branches should work', function(done) {
		req
			.get(restGit.pathPrefix + '/branches')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body.length).to.be(1);
				expect(res.body[0].name).to.be('master');
				expect(res.body[0].current).to.be(true);
				done();
			}));
	});

	var testBranch = 'testBranch';

	it('creating a branch should work', function(done) {
		req
			.post(restGit.pathPrefix + '/branches')
			.send({ path: testDir, name: testBranch, startPoint: 'master' })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	it('listing branches should show the new branch', function(done) {
		req
			.get(restGit.pathPrefix + '/branches')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body.length).to.be(2);
				expect(res.body[0].name).to.be('master');
				expect(res.body[0].current).to.be(true);
				expect(res.body[1].name).to.be(testBranch);
				expect(res.body[1].current).to.be(undefined);
				done();
			}));
	});

	it('should be possible to switch to a branch', function(done) {
		req
			.post(restGit.pathPrefix + '/branch')
			.send({ path: testDir, name: testBranch })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	it('listing branches should show the new branch as current', function(done) {
		req
			.get(restGit.pathPrefix + '/branches')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body.length).to.be(2);
				expect(res.body[0].name).to.be('master');
				expect(res.body[0].current).to.be(undefined);
				expect(res.body[1].name).to.be(testBranch);
				expect(res.body[1].current).to.be(true);
				done();
			}));
	});


	var testSubDir = 'sub';

	it('creating test sub dir should work', function(done) {
		req
			.post(restGit.pathPrefix + '/testing/createsubdir')
			.send({ dir: testSubDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	var testFile3 = path.join(testSubDir, 'testy.txt').replace('\\', '/');

	it('creating a test file in sub dir should work', function(done) {
		req
			.post(restGit.pathPrefix + '/testing/createfile')
			.send({ file: testFile3 })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	it('status should list the new file', function(done) {
		req
			.get(restGit.pathPrefix + '/status')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(Object.keys(res.body.files).length).to.be(1);
				expect(res.body.files[testFile3]).to.eql({
					isNew: true,
					staged: false
				});
				done();
			}));
	});

	var commitMessage3 = 'commit3';

	it('commit should succeed with file in sub dir', function(done) {
		req
			.post(restGit.pathPrefix + '/commit')
			.send({ path: testDir, message: commitMessage3, files: [testFile3] })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done));
	});

	it('log should show both branches and all commits', function(done) {
		req
			.get(restGit.pathPrefix + '/log')
			.query({ path: testDir })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(wrapErrorHandler(done, function(err, res) {
				expect(res.body).to.be.a('array');
				expect(res.body.length).to.be(2);
				var objs = {};
				res.body.forEach(function(obj) {
					obj.refs.sort();
					objs[obj.refs[0]] = obj;
				});
				var master = objs['refs/heads/master'];
				var HEAD = objs['HEAD'];
				expect(master.message).to.be(commitMessage);
				expect(master.title).to.be(commitMessage);
				expect(master.date).to.be.a('string');
				expect(master.authorName).to.be(gitConfig['user.name']);
				expect(master.authorEmail).to.be(gitConfig['user.email']);
				expect(master.refs).to.eql(['refs/heads/master']);
				expect(master.parents).to.eql([]);
				expect(master.sha1).to.be.ok();

				expect(HEAD.message).to.be(commitMessage3);
				expect(HEAD.title).to.be(commitMessage3);
				expect(HEAD.date).to.be.a('string');
				expect(HEAD.authorName).to.be(gitConfig['user.name']);
				expect(HEAD.authorEmail).to.be(gitConfig['user.email']);
				expect(HEAD.refs).to.eql(['HEAD', 'refs/heads/' + testBranch]);
				expect(HEAD.parents).to.eql([master.sha1]);
				expect(HEAD.sha1).to.be.ok();
				done();
			}));
	});

	it('removing test dir should work', function(done) {
		req
			.post(restGit.pathPrefix + '/testing/removedir')
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, done);
	});


})
