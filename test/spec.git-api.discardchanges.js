
var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var async = require('async');
var fs = require('fs');
var path = require('path');
var restGit = require('../source/git-api');
var common = require('./common.js');

var app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

var req = request(app);

describe('git-api discardchanges', function() {


  it('should be able to discard a new file', function(done) {
    common.createSmallRepo(req, function(err, dir) {
      if (err) return done(err);
      var testFile1 = 'test.txt';
      async.series([
        function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/discardchanges', { path: dir, file: testFile1 }, done); },
        function(done) {
          common.get(req, '/status', { path: dir }, function(err, res) {
            if (err) return done(err);
            expect(Object.keys(res.body.files).length).to.be(0);
            done();
          });
        }
      ], done);
    });
  });

  it('should be able to discard a changed file', function(done) {
    common.createSmallRepo(req, function(err, dir) {
      if (err) return done(err);
      var testFile1 = 'test.txt';
      async.series([
        function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/commit', { path: dir, message: 'lol', files: [testFile1] }, done); },
        function(done) { common.post(req, '/testing/changefile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/discardchanges', { path: dir, file: testFile1 }, done); },
        function(done) {
          common.get(req, '/status', { path: dir }, function(err, res) {
            if (err) return done(err);
            expect(Object.keys(res.body.files).length).to.be(0);
            done();
          });
        }
      ], done);
    });
  });

  it('should be able to discard a removed file', function(done) {
    common.createSmallRepo(req, function(err, dir) {
      if (err) return done(err);
      var testFile1 = 'test.txt';
      async.series([
        function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/commit', { path: dir, message: 'lol', files: [testFile1] }, done); },
        function(done) { common.post(req, '/testing/removefile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/discardchanges', { path: dir, file: testFile1 }, done); },
        function(done) {
          common.get(req, '/status', { path: dir }, function(err, res) {
            if (err) return done(err);
            expect(Object.keys(res.body.files).length).to.be(0);
            done();
          });
        }
      ], done);
    });
  });

  it('should be able to discard a new and staged file', function(done) {
    common.createSmallRepo(req, function(err, dir) {
      if (err) return done(err);
      var testFile1 = 'test.txt';
      async.series([
        function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/testing/git', { repo: dir, command: ['add', testFile1] }, done); },
        function(done) { common.post(req, '/discardchanges', { path: dir, file: testFile1 }, done); },
        function(done) {
          common.get(req, '/status', { path: dir }, function(err, res) {
            if (err) return done(err);
            expect(Object.keys(res.body.files).length).to.be(0);
            done();
          });
        },
      ], done);
    });
  });

  it('should be able to discard a staged and removed file', function(done) {
    common.createSmallRepo(req, function(err, dir) {
      if (err) return done(err);
      var testFile1 = 'test.txt';
      async.series([
        function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/testing/git', { repo: dir, command: ['add', testFile1] }, done); },
        function(done) { common.post(req, '/testing/removefile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/discardchanges', { path: dir, file: testFile1 }, done); },
        function(done) {
          common.get(req, '/status', { path: dir }, function(err, res) {
            if (err) return done(err);
            expect(Object.keys(res.body.files).length).to.be(0);
            done();
          });
        },
      ], done);
    });
  });

  // Need to make discardchanges even more powerful to handle this
  /*it('should be able to discard a commited, staged and removed file', function(done) {
    common.createSmallRepo(req, function(dir) {
      if (err) return done(err);
      var testFile1 = 'test.txt';
      async.series([
        function(done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/commit', { path: dir, message: 'lol', files: [testFile1] }, done); },
        function(done) { common.post(req, '/testing/changefile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/testing/git', { repo: dir, command: ['add', testFile1] }, done); },
        function(done) { common.post(req, '/testing/removefile', { file: path.join(dir, testFile1) }, done); },
        function(done) { common.post(req, '/discardchanges', { path: dir, file: testFile1 }, done); },
        function(done) { common.get(req, '/status', { path: dir }, function(err, res) {
          if (err) return done(err);
          expect(Object.keys(res.body.files).length).to.be(0);
          done();
        }); },
      ], done);
    });
  });*/
})
