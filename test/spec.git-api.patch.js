var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var restGit = require('../source/git-api');
var common = require('./common.js');
var mkdirp = require('mkdirp');
var async = require('async');
var Promise = require('bluebird');
var uuid = require('uuid');
var wrapErrorHandler = common.wrapErrorHandler;

var app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

var testDir;
var req = request(app);

var promisifiedPost = function(req, route, args) {
  return new Promise(function (resolve, reject) {
    common.post(req, route, args, function(err, res) {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

var testPatch = function(req, testDir, testFileName, contentsToPatch, files) {
  return promisifiedPost(req, '/testing/createfile', { file: path.join(testDir, testFileName), content: contentsToPatch[0] })
  .then(promisifiedPost.bind(null, req, '/commit', { path: testDir, message: 'a commit for ' + testFileName, files: [{ name: testFileName }] }))
  .then(promisifiedPost.bind(null, req, '/testing/changefile', { file: path.join(testDir, testFileName), content: contentsToPatch[1] }))
  .then(promisifiedPost.bind(null, req, '/commit', { path: testDir, message: 'patched commit ' + testFileName, files: files }));
}

var getPatchLineList = function(size, notSelected) {
  var patchLineList = [];
  for (var n = 0; n < size; n++) {
    patchLineList.push(false);
  }
  
  if (notSelected) {
    for (var m = 0; m < notSelected.length; m++) {
      patchLineList[notSelected[m]] = true;
    }
  }
  return patchLineList;
}

var getContentsToPatch = function(size, toChange) {
  var content = '';
  var changedContent = '';

  for (var n = 0; n < size; n++) {
    content += (n + '\n');
    if (!toChange || toChange.indexOf(n) > -1) {
      changedContent += (n + '!\n');
    }
  }
  
  return [content, changedContent];
}

describe('git-api', function () {
  it('creating test dir should work', function(done) {
    common.post(req, '/testing/createtempdir', undefined, function(err, res) {
      if (err) return done(err);
      expect(res.body.path).to.be.ok();
      testDir = res.body.path;
      done();
    });
  });
  
  it('init test dir should work', function(done) {
    common.post(req, '/init', { path: testDir, bare: false }, done);
  });
  
  
  ///////////////////////////////////////////////////////
  // Single diff block diff, (git apply uses diff -U3) //
  ///////////////////////////////////////////////////////
  
  it('Create a file with 10 lines, commit, change each 10 lines, and commit patch with all selected.', function(complete) {
    var testFileName = uuid();
    var testFileSize = 10;
    var patchLineList = [];
    var contentsToPatch = getContentsToPatch(testFileSize);
    
    for (var n = 0; n < testFileSize * 2; n++) {
      patchLineList.push(true);
    }
    
    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete); 
  });
  
  it('Create a file with 10 lines, commit, change each 10 lines, and commit patch with none selected.', function(complete) {
    var testFileName = uuid();
    var testFileSize = 10;
    var patchLineList = getPatchLineList(testFileSize * 2);
    var contentsToPatch = getContentsToPatch(testFileSize);
    
    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });
  
  it('10 lines, 10 diff, 0~2 selected', function(complete) {
    var testFileName = uuid();
    var testFileSize = 10;
    var patchLineList = getPatchLineList(testFileSize * 2, [0, 1, 2]);
    var contentsToPatch = getContentsToPatch(testFileSize);
    
    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });
  
  // 10 lines, 10 diff, 8~9 selected
  
  // 10 lines, 10 diff, 0~2 and 8 ~ 9 selected
  
  // 10 lines, 10 diff, 5~7 selected
  
  // 30 lines, 30 diff, 0~2 and 28 ~ 29 selected
  
  // 30 lines, 30 diff, 16~18 and 27 selected
  
  // 30 lines, 30 diff, 6~8, 16~18 and 27 selected
  
  // 30 lines, 30 diff, 12~15 and 17~19 selected
  
  
  
  //////////////////////////////////////////////////////
  // Multi diff block diff, (git apply uses diff -U3) //
  //////////////////////////////////////////////////////
  
  // 30 lines, 12~19 diff, 12~15 and 17~19 selected  
  
  // 30 lines, 2~4, 12~14, 22~24 diff 2~4, 12~14, 22~24 selected
  
  // 30 lines, 2~4, 12~14, 22~24 diff 2~4, 22~24 selected
  
  // 30 lines, 2~4, 12~14, 22~24 diff 12~14 selected
  
  // 30 lines, 2~4, 12~14, 22~24 diff none selected
  
  // 30 lines, 12~14, 16~18 diff 16~18 selected   this will screw with diff block header
  
});
