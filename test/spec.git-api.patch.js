var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var restGit = require('../src/git-api');
var common = require('./common.js');
var mkdirp = require('mkdirp');
var async = require('async');
var Promise = require('bluebird');
var md5 = require('blueimp-md5');
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
  // testDir = '/tmp/testdir';
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
    changedContent += n;
    if (!toChange || toChange.indexOf(n) > -1) {
      changedContent += '!';
    }
    changedContent += '\n';
  }

  return [content, changedContent];
}

var getContentsToPatchWithAdd = function(size, numLinesToAdd) {
  var content = '';
  var changedContent = '';
  var n = 0;

  while (n < size) {
    content += (n + '\n');
    changedContent += (n + '\n');
    n++;
  }
  while (n < size + numLinesToAdd) {
    changedContent += (n + '\n');
    n++;
  }

  return [content, changedContent];
}

var getContentsToPatchWithDelete = function(size, numLinesToDelete) {
  var content = '';
  var changedContent = '';
  var n = 0;

  while (n < size) {
    content += (n + '\n');
    if (n  < size - numLinesToDelete) {
      changedContent += (n + '\n');
    }
    n++;
  }

  return [content, changedContent];
}

describe('git-api: test patch api', function () {
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
    var testFileName = md5(Date.now());
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
    var testFileName = md5(Date.now());
    var testFileSize = 10;
    var patchLineList = getPatchLineList(testFileSize * 2);
    var contentsToPatch = getContentsToPatch(testFileSize);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('10 lines, 10 edit, 0~2 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 10;
    var patchLineList = getPatchLineList(testFileSize * 2, [0, 1, 2]);
    var contentsToPatch = getContentsToPatch(testFileSize);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('10 lines, 10 edit, 18~19 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 10;
    var patchLineList = getPatchLineList(testFileSize * 2, [18, 19]);
    var contentsToPatch = getContentsToPatch(testFileSize);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('10 lines, 10 edit, 0~2 and 18~19 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 10;
    var patchLineList = getPatchLineList(testFileSize * 2, [0, 1, 2, 18, 19]);
    var contentsToPatch = getContentsToPatch(testFileSize);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('10 lines, 10 edit, 5~7 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 10;
    var patchLineList = getPatchLineList(testFileSize * 2, [5, 6, 7]);
    var contentsToPatch = getContentsToPatch(testFileSize);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('30 lines, 30 edit, 0~2 and 28 ~ 29 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 30;
    var patchLineList = getPatchLineList(testFileSize * 2, [0, 1, 2, 28, 29]);
    var contentsToPatch = getContentsToPatch(testFileSize);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('30 lines, 30 edit, 0~2, 28~29, 58~59 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 30;
    var patchLineList = getPatchLineList(testFileSize * 2, [0, 1, 2, 28, 29, 57, 58, 59]);
    var contentsToPatch = getContentsToPatch(testFileSize);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('30 lines, 30 edit, 6~8, 16~18 and 58 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 30;
    var patchLineList = getPatchLineList(testFileSize * 2, [6, 7, 8, 16, 17, 18, 58]);
    var contentsToPatch = getContentsToPatch(testFileSize);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('30 lines, 30 edit, 12~15 and 17~19 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 30;
    var patchLineList = getPatchLineList(testFileSize * 2, [12, 13, 14, 15, 17, 18, 19]);
    var contentsToPatch = getContentsToPatch(testFileSize);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('30 lines, 12~19 edit, 0~7, 10~16 selected ', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 30;
    var linesToChange = [12, 13, 14, 15, 16, 17, 18, 19];
    var contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    var patchLineList = getPatchLineList(linesToChange.length * 2, [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16]);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  //////////////////////////////////////////////////////
  // Multi diff block diff, (git apply uses diff -U3) //
  //////////////////////////////////////////////////////

  it('30 lines, 2~4, 12~14, 22~24 edit, all selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 30;
    var linesToChange = [2, 3, 4, 12, 13, 14, 22, 23, 24];
    var contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    var patchLineList = getPatchLineList(linesToChange.length * 2, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('30 lines, 2~4, 12~14, 22~24 edit, 0~5, 12~17 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 30;
    var linesToChange = [2, 3, 4, 12, 13, 14, 22, 23, 24];
    var contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    var patchLineList = getPatchLineList(linesToChange.length * 2, [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17]);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('30 lines, 2~4, 12~14, 22~24 edit, 6~11 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 30;
    var linesToChange = [2, 3, 4, 12, 13, 14, 22, 23, 24];
    var contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    var patchLineList = getPatchLineList(linesToChange.length * 2, [6, 7, 8, 9, 10, 11]);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('30 lines, 2~4, 12~14, 22~24 edit, none selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 30;
    var linesToChange = [2, 3, 4, 12, 13, 14, 22, 23, 24];
    var contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    var patchLineList = getPatchLineList(linesToChange.length * 2);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  it('30 lines, 12~14, 16~18 edit, 6~11 selected', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 30;
    var linesToChange = [12, 13, 14, 22, 23, 24];
    var contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    var patchLineList = getPatchLineList(linesToChange.length * 2, [6, 7, 8, 9, 10, 11]);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  // added diff only, (git apply uses diff -U3)
  it('10 lines, add 5 lines, select 0~1, 5', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 10;
    var linesToAdd = 5;
    var contentsToPatch = getContentsToPatchWithAdd(testFileSize, linesToAdd);
    var patchLineList = getPatchLineList(linesToAdd, [0, 1, 5]);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });

  // deleted diff only, (git apply uses diff -U3)
  it('10 lines, delete 5 lines, select 0~1, 5', function(complete) {
    var testFileName = md5(Date.now());
    var testFileSize = 10;
    var linesToDelete = 5;
    var contentsToPatch = getContentsToPatchWithDelete(testFileSize, linesToDelete);
    var patchLineList = getPatchLineList(linesToDelete, [0, 1, 5]);

    testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }])
      .done(complete.bind(null, null), complete);
  });
});
