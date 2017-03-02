var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var restGit = require('../src/git-api');
var common = require('./common.js');
var Bluebird = require('bluebird');

var app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

var req = request(app);

describe('git-api diff', function () {

  var testDir, testBareDir;

  before(function(done) {
    Bluebird.all([common.createEmptyRepo(req), common.initRepo(req, { bare: true })])
      .then(function(results) {
        testDir = results[0];
        testBareDir = results[1];
      }).then(function() { done(); }).catch(done);
  });

  var testFile = 'afile.txt';
  var testImage = 'icon.png'

  it('diff on non existing file should fail', function(done) {
    req
      .get(restGit.pathPrefix + '/diff')
      .query({ path: testDir, file: testFile })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(function() { done(); }).catch(done);
  });

  var content;

  it('should be possible to create a file', function(done) {
    content = ['A', 'few', 'lines', 'of', 'content', ''];
    common.post(req, '/testing/createfile', { file: path.join(testDir, testFile), content: content.join('\n') })
      .then(function() { done(); }).catch(done);
  });

  it('should be possible to create an image file', function(done) {
    common.post(req, '/testing/createimagefile', { file: path.join(testDir, testImage) })
      .then(function() { done(); }).catch(done);
  });

  it('diff on created file should work', function(done) {
    common.get(req, '/diff', { path: testDir, file: testFile }).then(function(res) {
      for(var i = 0; i < content.length; i++) {
        expect(res.body.indexOf(content[i])).to.be.above(-1);
      }
    }).then(function() { done(); }).catch(done);
  });

  it('diff on image file should work', function(done) {
    common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' }).then(function(res) {
      expect(res.body.toString()).to.be('png');
    }).then(function() { done(); }).catch(done);
  });

  it('should be possible to commit a file', function(done) {
    common.post(req, '/commit', { path: testDir, message: "Init", files: [{ name: testFile }] })
      .then(function() { done(); }).catch(done);
  });
  it('should be possible to commit an image file', function(done) {
    common.post(req, '/commit', { path: testDir, message: "Init", files: [{ name: testImage }] })
      .then(function() { done(); }).catch(done);
  });

  it('diff on commited file should work', function(done) {
    common.get(req, '/diff', { path: testDir, file: testFile }).then(function(res) {
      expect(res.body).to.be.an('array');
      expect(res.body.length).to.be(0);
    }).then(function() { done(); }).catch(done);
  });

  it('diff on commited image file should work', function(done) {
    common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' }).then(function(res) {
      expect(res.body.toString()).to.be('png');
    }).then(function() { done(); }).catch(done);
  });

  it('should be possible to modify a file', function(done) {
    content.splice(2, 0, 'more');
    common.post(req, '/testing/changefile', { file: path.join(testDir, testFile), content: content.join('\n') })
      .then(function() { done(); }).catch(done);
  });

  it('should be possible to modify an image file', function(done) {
    common.post(req, '/testing/changeimagefile', { file: path.join(testDir, testImage) })
      .then(function() { done(); }).catch(done);
  });

  it('diff on modified file should work', function(done) {
    common.get(req, '/diff', { path: testDir, file: testFile }).then(function(res) {
      expect(res.body.indexOf('diff --git a/afile.txt b/afile.txt')).to.be.above(-1);
      expect(res.body.indexOf('+more')).to.be.above(-1);
    }).then(function() { done(); }).catch(done);
  });

  it('getting current image file should work', function(done) {
    common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' }).then(function(res) {
      expect(res.body.toString()).to.be('png ~~');
    }).then(function() { done(); }).catch(done);
  });

  it('getting previous image file should work', function(done) {
    common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'HEAD' }).then(function(res) {
      expect(res.body.toString()).to.be('png');
    }).then(function() { done(); }).catch(done);
  });

  it('should be possible to commit a file', function(done) {
    common.post(req, '/commit', { path: testDir, message: "Init", files: [{ name: testFile }] })
      .then(function() { done(); }).catch(done);
  });

  it('removing a test file should work', function(done) {
    common.post(req, '/testing/removefile', { file: path.join(testDir, testFile) })
      .then(function() { done(); }).catch(done);
  });

  it('should be possible to commit an image file', function(done) {
    common.post(req, '/commit', { path: testDir, message: "Init", files: [{ name: testImage }] })
      .then(function() { done(); }).catch(done);
  });
  it('removing a test image file should work', function(done) {
    common.post(req, '/testing/removefile', { file: path.join(testDir, testImage) })
      .then(function() { done(); }).catch(done);
  });

  it('diff on removed file should work', function(done) {
    common.get(req, '/diff', { path: testDir, file: testFile }).then(function(res) {
      expect(res.body.indexOf('deleted file')).to.be.above(-1);
      expect(res.body.indexOf("@@ -1,6 +0,0 @@")).to.be.above(-1);
    }).then(function() { done(); }).catch(done);
  });

  it('getting previous image file should work', function(done) {
    common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'HEAD' }).then(function(res) {
      expect(res.body.toString()).to.be('png ~~');
    }).then(function() { done(); }).catch(done);
  });

  it('diff on bare repository file should work', function(done) {
    // first add remote and push all commits
    common.post(req, '/remotes/barerepository', { path: testDir, url: testBareDir })
      .then(function() { return common.post(req, '/push', { path: testDir, remote: 'barerepository' }); })
      .then(function() {
        return common.get(req, '/log', { path: testBareDir }, function(res) {
          // find a commit which contains the testFile
          var commit = res.body.nodes.filter(function(commit) { return commit.fileLineDiffs.some(function(lineDiff) { return lineDiff[2] == testFile; }) })[0];
          return common.get(req, '/diff', { path: testBareDir, sha1: commit.sha1, file: testFile });
        });
      }).then(function() { done(); }).catch(done);
  });

  after(function(done) {
    common.post(req, '/testing/cleanup', undefined)
      .then(function() { done(); }).catch(done);
  });

});
