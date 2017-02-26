
var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var restGit = require('../src/git-api');
var common = require('./common.js');

var app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

var req = request(app);

describe('git-api discardchanges', function() {


  it('should be able to discard a new file', function(done) {
    common.createSmallRepo(req).then(function(dir) {
      var testFile1 = 'test.txt';
      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) })
        .then(function() { return common.post(req, '/discardchanges', { path: dir, file: testFile1 }); })
        .then(function() { return common.get(req, '/status', { path: dir }) })
        .then(function(res) { expect(Object.keys(res.body.files).length).to.be(0); });
    }).then(function() { done(); }).catch(done);
  });

  it('should be able to discard a changed file', function(done) {
    common.createSmallRepo(req).then(function(dir) {
      var testFile1 = 'test.txt';
      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) })
        .then(function() { return common.post(req, '/commit', { path: dir, message: 'lol', files: [{ name: testFile1 }] }); })
        .then(function() { return common.post(req, '/testing/changefile', { file: path.join(dir, testFile1) }); })
        .then(function() { return common.post(req, '/discardchanges', { path: dir, file: testFile1 }); })
        .then(function() { return common.get(req, '/status', { path: dir }); })
        .then(function(res) { expect(Object.keys(res.body.files).length).to.be(0); });
    }).then(function() { done(); }).catch(done);
  });

  it('should be able to discard a removed file', function(done) {
    common.createSmallRepo(req).then(function(dir) {
      var testFile1 = 'test.txt';
      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) })
        .then(function() { return common.post(req, '/commit', { path: dir, message: 'lol', files: [{ name: testFile1 }] }); })
        .then(function() { return common.post(req, '/testing/removefile', { file: path.join(dir, testFile1) }); })
        .then(function() { return common.post(req, '/discardchanges', { path: dir, file: testFile1 }); })
        .then(function() { return common.get(req, '/status', { path: dir }); })
        .then(function(res) { expect(Object.keys(res.body.files).length).to.be(0); });
    }).then(function() { done(); }).catch(done);
  });

  it('should be able to discard a new and staged file', function(done) {
    common.createSmallRepo(req).then(function(dir) {
      var testFile1 = 'test.txt';
      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) })
        .then(function() { return common.post(req, '/testing/git', { repo: dir, command: ['add', testFile1] }); })
        .then(function() { return common.post(req, '/discardchanges', { path: dir, file: testFile1 }); })
        .then(function() { return common.get(req, '/status', { path: dir }); })
        .then(function(res) { expect(Object.keys(res.body.files).length).to.be(0); });
    }).then(function() { done(); }).catch(done);
  });

  it('should be able to discard a staged and removed file', function(done) {
    common.createSmallRepo(req).then(function(dir) {
      var testFile1 = 'test.txt';
      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) })
        .then(function() { return common.post(req, '/testing/git', { repo: dir, command: ['add', testFile1] }); })
        .then(function() { return common.post(req, '/testing/removefile', { file: path.join(dir, testFile1) }); })
        .then(function() { return common.post(req, '/discardchanges', { path: dir, file: testFile1 }); })
        .then(function() { return common.get(req, '/status', { path: dir }); })
        .then(function(res) { expect(Object.keys(res.body.files).length).to.be(0); });
    }).then(function() { done(); }).catch(done);
  });

  // Need to make discardchanges even more powerful to handle this
  /*it('should be able to discard a commited, staged and removed file', function(done) {
    common.createSmallRepo(req, function(dir) {
      if (err) return done(err);
      var testFile1 = 'test.txt';
      async.series([
        .then(function() { return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) }, done); },
        .then(function() { return common.post(req, '/commit', { path: dir, message: 'lol', files: [{ name: testFile1 }] }, done); },
        .then(function() { return common.post(req, '/testing/changefile', { file: path.join(dir, testFile1) }, done); },
        .then(function() { return common.post(req, '/testing/git', { repo: dir, command: ['add', testFile1] }, done); },
        .then(function() { return common.post(req, '/testing/removefile', { file: path.join(dir, testFile1) }, done); },
        .then(function() { return common.post(req, '/discardchanges', { path: dir, file: testFile1 }, done); },
        .then(function() { return common.get(req, '/status', { path: dir }, function(err, res) {
          if (err) return done(err);
          expect(Object.keys(res.body.files).length).to.be(0);
          done();
        }); },
      ], done);
    });
  });*/

  after(function(done) {
    common.post(req, '/testing/cleanup', undefined)
      .then(function() { done(); }).catch(done);
  });

});
