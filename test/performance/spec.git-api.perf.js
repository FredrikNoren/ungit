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

  var oneMbFile = 'smallFile.txt';
  var fiveMbFile = 'mediumFile.txt';
  var tenMbFile = 'largeFile.txt';

  var generateTestFiles = function() {
    testFileGenerator.generateTestFile(path.join(testDir, oneMbFile), 1024);
    testFileGenerator.generateTestFile(path.join(testDir, fiveMbFile), 5120);
    testFileGenerator.generateTestFile(path.join(testDir, tenMbFile), 10240);
  }

  // Need a more realistic way to alter file as this doesn't have 100% test coverage
  var changeTestFiles = function() {
    generateTestFiles();
  }

  it('create test files', function(done) {
    generateTestFiles();
    common.post(req, '/commit', { path: testDir, message: 'whateve', files: [oneMbFile, fiveMbFile, tenMbFile] }, function() {
      changeTestFiles();
      done();
    });
  });

  it('git log performance test', function(done) {
    performanceHelper.runner(req, '/log', { path: testDir }, 10, done);
  });

  it('git diff performance test on 1mb File', function(done) {
    performanceHelper.runner(req, '/diff', { path: testDir, file: oneMbFile }, 10, done);
  });

  it('git diff performance test on 5mb File', function(done) {
    performanceHelper.runner(req, '/diff', { path: testDir, file: fiveMbFile }, 10, done);
  });

  it('git diff performance test on 10mb File', function(done) {
    performanceHelper.runner(req, '/diff', { path: testDir, file: tenMbFile }, 10, done);
  });
});
