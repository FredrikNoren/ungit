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

describe('git-api: test ignorefile call', function () {

  it('Add a file to .gitignore file through api call', function (done) {
    common.createSmallRepo(req).then(function (dir) {
      var testFile = 'test.txt';

      // Create .gitignore file prior to append
      fs.writeFileSync(path.join(dir, '.gitignore'), 'test git ignore file...');

      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile) })
        .then(function() { return common.post(req, '/ignorefile', { path: dir, file: testFile }); })
        .then(function() { return common.get(req, '/status', { path: dir }); })
        .then(function (res) {
            expect(Object.keys(res.body.files).toString()).to.be('.gitignore');
            fs.readFile(path.join(dir, '.gitignore'), function (err, data) {
              if (data.toString().indexOf(testFile) > 0) {
                done();
              } else {
                done(new Error('Test file is not added to the .gitignore file.'));
              }
            });
          });
    });
  });

  it('Add a file to .gitignore file through api call when .gitignore is missing', function (done) {
    common.createSmallRepo(req).then(function (dir) {
      var testFile = 'test.txt';

      // Missing .gitignore file prior to append
      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile) })
        .then(function() { return common.post(req, '/ignorefile', { path: dir, file: testFile }); })
        .then(function() { return common.get(req, '/status', { path: dir }); })
        .then(function (res) {
            expect(Object.keys(res.body.files).toString()).to.be('.gitignore');
            fs.readFile(path.join(dir, '.gitignore'), function (err, data) {
              if (data.toString().indexOf(testFile) > 0) {
                done();
              } else {
                done(new Error('Test file is not added to the .gitignore file.'));
              }
            });
          });
    });
  });

  it('Attempt to add a file where similar name alread exist in .gitignore through api call', function (done) {
    common.createSmallRepo(req).then(function (dir) {
      var testFile = 'test.txt';

      // add part of file name to gitignore
      fs.appendFileSync(path.join(dir, '.gitignore'), testFile.split('.')[0]);

      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile) })
        .then(function() { return common.post(req, '/ignorefile', { path: dir, file: testFile }) })
        .then(function() { return common.get(req, '/status', { path: dir }); })
        .then(function(res) {
            expect(Object.keys(res.body.files).toString()).to.be('.gitignore');
            fs.readFile(path.join(dir, '.gitignore'), function (err, data) {
              if (data.toString().indexOf(testFile) > 0) {
                done();
              } else {
                done(new Error('Test file is not added to the .gitignore file.'));
              }
            });
          });
    });
  });

  after(function(done) {
    common.post(req, '/testing/cleanup', undefined)
      .then(function() { done() }).catch(done);
  });

});
