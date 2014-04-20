var testFileGenerator = require('./test-file-generator.js');
var performanceHelper = require('./performance-test-helper.js');
var request = require('supertest');
var express = require('express');
var restGit = require('../../source/git-api');
var path = require('path');
var common = require('../common.js');
var cliColor = require('ansi-color');

var app = express();
app.use(require('body-parser')());

restGit.registerApi({ app: app, config: { dev: true } });

var req = request(app);

console.log('\n');
console.log(cliColor.set('--Error or interrupt during this test may leave large files at the test directory.', 'red'));
console.log(cliColor.set('--Manual clean up may require in such cases.', 'red'));

describe('performance testing', function () {
  this.timeout(120000);

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

  var generateInitialTestFiles = function() {
    testFileGenerator.generateTestFile(path.join(testDir, oneMbFile), 1024);
    testFileGenerator.generateTestFile(path.join(testDir, fiveMbFile), 5120);
    testFileGenerator.generateTestFile(path.join(testDir, tenMbFile), 10240);
  }

  // Need a more realistic way to alter file as this doesn't have 100% test coverage
  var changeTestFiles = function() {
    generateInitialTestFiles();
  }

  it('create test files', function(done) {
    generateInitialTestFiles();
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

  // it('git diff performance test on 10mb File', function(done) {
  //   performanceHelper.runner(req, '/diff', { path: testDir, file: tenMbFile }, 10, done);
  // });

  it('large file changes that will break git log --numstat parsing', function(done) {
    var fileNames = [];
    
    for(var n = 0; n < 300; n++) {
      var fileName = testFileGenerator.getRandomString(10);
      testFileGenerator.generateTestFile(path.join(testDir, fileName), 1024);
      fileNames.push(fileName);
    }

    common.post(req, '/commit', { path: testDir, message: 'whateve', files: [oneMbFile, fiveMbFile, tenMbFile] }, function() {
      for(var n = 0; n < fileNames.length; n++) {
        testFileGenerator.generateTestFile(path.join(testDir, fileName), 1024);
      }
      performanceHelper.runner(req, '/log', { path: testDir }, 10, done);
    });
  });
});
