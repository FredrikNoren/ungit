var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var async = require('async');
var fs = require('fs');
var path = require('path');
var restGit = require('../src/git-api');
var common = require('./common.js');

var app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

var req = request(app);

describe('git-api: test ignorefile call', function () {

  it('Add a file to .gitignore file through api call', function (done) {
    common.createSmallRepo(req, function (err, dir) {
      if (err) return done(err);
      var testFile = 'test.txt';

      // Create .gitignore file prior to append
      fs.writeFileSync(path.join(dir, '.gitignore'), 'test git ignore file...');

      async.series([

        function (done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile) }, done); },
        function (done) { common.post(req, '/ignorefile', { path: dir, file: testFile }, done); },
        function (done) {
          common.get(req, '/status', { path: dir }, function (err, res) {
            if (err) return done(err);
            expect(Object.keys(res.body.files).toString()).to.be('.gitignore');
            fs.readFile(path.join(dir, '.gitignore'), function (err, data) {
              if (data.toString().indexOf(testFile) > 0) {
                done();
              } else {
                throw new Error('Test file is not added to the .gitignore file.');
              }
            });
          });
        }
      ], done);
    });
  });

  it('Add a file to .gitignore file through api call when .gitignore is missing', function (done) {
    common.createSmallRepo(req, function (err, dir) {
      if (err) return done(err);
      var testFile = 'test.txt';

      // Missing .gitignore file prior to append
      async.series([

        function (done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile) }, done); },
        function (done) { common.post(req, '/ignorefile', { path: dir, file: testFile }, done); },
        function (done) {
          common.get(req, '/status', { path: dir }, function (err, res) {
            if (err) return done(err);
            expect(Object.keys(res.body.files).toString()).to.be('.gitignore');
            fs.readFile(path.join(dir, '.gitignore'), function (err, data) {
              if (data.toString().indexOf(testFile) > 0) {
                done();
              } else {
                throw new Error('Test file is not added to the .gitignore file.');
              }
            });
          });
        }
      ], done);
    });
  });

  it('Attempt to add a file where similar name alread exist in .gitignore through api call', function (done) {
    common.createSmallRepo(req, function (err, dir) {
      if (err) return done(err);
      var testFile = 'test.txt';

      // add part of file name to gitignore
      fs.appendFileSync(path.join(dir, '.gitignore'), testFile.split('.')[0]);

      async.series([

        function (done) { common.post(req, '/testing/createfile', { file: path.join(dir, testFile) }, done); },
        function (done) { common.post(req, '/ignorefile', { path: dir, file: testFile }, done); },
        function (done) {
          common.get(req, '/status', { path: dir }, function (err, res) {
            if (err) return done(err);
            expect(Object.keys(res.body.files).toString()).to.be('.gitignore');
            fs.readFile(path.join(dir, '.gitignore'), function (err, data) {
              if (data.toString().indexOf(testFile) > 0) {
                done();
              } else {
                throw new Error('Test file is not added to the .gitignore file.');
              }
            });
          });
        }
      ], done);
    });
  });

  after(function(done) {
    common.post(req, '/testing/cleanup', undefined, done);
  });

});
