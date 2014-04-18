var testFileGenerator = require('./test-file-generator.js');
var performanceHelper = require('./performance-test-helper.js');
var request = require('supertest');
var express = require('express');
var restGit = require('../../source/git-api');
var path = require('path');
var common = require('../common.js');

var app = express();
app.use(require('body-parser')());

restGit.registerApi({ app: app, config: { dev: true } });

var req = request(app);

console.log('\n');
console.log('--Error or interrupt during this test may leave large files at the test directory.');
console.log('--Manual clean up may require in such cases.');

describe('performance testing', function () {
  this.timeout(60000);

  var testDir;
  before(function(done) {
    common.createEmptyRepo(req, function(err, dir) {
      if (err) return done(err);

      testDir = dir;
      console.log('Test directory: [' + testDir + ']');

      done();
    });
  });

  var oneMbFile = '1mbFile.txt';
  var tenMbFile = '10mbFile.txt';
  var thirtyMbFile = '30mbFile.txt';

  var generateTestFiles = function() {
    testFileGenerator.generateTestFile(path.join(testDir, oneMbFile), 1024);
    testFileGenerator.generateTestFile(path.join(testDir, tenMbFile), 10240);
    testFileGenerator.generateTestFile(path.join(testDir, thirtyMbFile), 30720);
  }

  // Need a more realistic way to alter file as this doesn't have 100% test coverage
  var changeTestFiles = function() {
    generateTestFiles();
  }

  it('create test files', function(done) {
    generateTestFiles();
    common.post(req, '/commit', { path: testDir, message: 'whateve', files: [oneMbFile, tenMbFile, thirtyMbFile] }, function() {
      changeTestFiles();
      done();
    });
  });

  it('git log performance test', function(done) {
    performanceHelper.runner(req, '/log', { path: testDir }, 10, done);
  });
});