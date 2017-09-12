const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../src/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

const req = request(app);

describe('git-api diff', () => {
  let testDir, testBareDir;

  before(() => {
    return common.initRepo(req)
      .then((dir) => testDir = dir)
      .then(() => common.initRepo(req, { bare: true }))
      .then((dir) => testBareDir = testBareDir)
  });
  after(() => common.post(req, '/testing/cleanup', undefined));

  const testFile = 'afile.txt';
  const testImage = 'icon.png'

  it('diff on non existing file should fail', () => {
    return common.get(req, '/diff', { path: testDir, file: testFile });
  });

  let content;

  it('should be possible to create a file', () => {
    content = ['A', 'few', 'lines', 'of', 'content', ''];

    return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile), content: content.join('\n') });
  });

  it('should be possible to create an image file', () => {
    return common.post(req, '/testing/createimagefile', { file: path.join(testDir, testImage) });
  });

  it('diff on created file should work', () => {
    return common.get(req, '/diff', { path: testDir, file: testFile }).then((res) => {
      for(let i = 0; i < content.length; i++) {
        expect(res.indexOf(content[i])).to.be.above(-1);
      }
    });
  });

  it('diff on image file should work', () => {
    return common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' })
      .then((res) => expect(res.toString()).to.be('png'));
  });

  it('should be possible to commit a file', () => {
    return common.post(req, '/commit', { path: testDir, message: "Init", files: [{ name: testFile }] });
  });
  it('should be possible to commit an image file', () => {
    return common.post(req, '/commit', { path: testDir, message: "Init", files: [{ name: testImage }] });
  });

  it('diff on commited file should work', () => {
    return common.get(req, '/diff', { path: testDir, file: testFile }).then((res) => {
      expect(res).to.be.an('array');
      expect(res.length).to.be(0);
    });
  });

  it('diff on commited image file should work', () => {
    return common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' })
      .then((res) => expect(res.toString()).to.be('png'));
  });

  it('should be possible to modify a file', () => {
    content.splice(2, 0, 'more');
    return common.post(req, '/testing/changefile', { file: path.join(testDir, testFile), content: content.join('\n') });
  });

  it('should be possible to modify an image file', () => {
    return common.post(req, '/testing/changeimagefile', { file: path.join(testDir, testImage) });
  });

  it('diff on modified file should work', () => {
    return common.get(req, '/diff', { path: testDir, file: testFile }).then((res) => {
      expect(res.indexOf('diff --git a/afile.txt b/afile.txt')).to.be.above(-1);
      expect(res.indexOf('+more')).to.be.above(-1);
    });
  });

  it('getting current image file should work', () => {
    return common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' })
      .then((res) => expect(res.toString()).to.be('png ~~'));
  });

  it('getting previous image file should work', () => {
    return common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'HEAD' })
      .then((res) => expect(res.toString()).to.be('png'));
  });

  it('should be possible to commit a file', () => {
    return common.post(req, '/commit', { path: testDir, message: "Init", files: [{ name: testFile }] });
  });

  it('removing a test file should work', () => {
    return common.post(req, '/testing/removefile', { file: path.join(testDir, testFile) });
  });

  it('should be possible to commit an image file', () => {
    return common.post(req, '/commit', { path: testDir, message: "Init", files: [{ name: testImage }] });
  });
  it('removing a test image file should work', () => {
    return common.post(req, '/testing/removefile', { file: path.join(testDir, testImage) });
  });

  it('diff on removed file should work', () => {
    return common.get(req, '/diff', { path: testDir, file: testFile })
      .then((res) => {
        expect(res.indexOf('deleted file')).to.be.above(-1);
        expect(res.indexOf("@@ -1,6 +0,0 @@")).to.be.above(-1);
      });
  });

  it('getting previous image file should work', () => {
    return common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'HEAD' })
      .then((res) => expect(res.toString()).to.be('png ~~'));
  });

  it('diff on bare repository file should work', () => {
    // first add remote and push all commits
    return common.post(req, '/remotes/barerepository', { path: testDir, url: testBareDir })
      .then(() => common.post(req, '/push', { path: testDir, remote: 'barerepository' }))
      .then(() => common.get(req, '/log', { path: testDir }))
      .then((res) => {
        // find a commit which contains the testFile
        const commit = res.nodes.filter((commit) => commit.fileLineDiffs.some((lineDiff) => lineDiff[2] == testFile))[0];
        return common.get(req, '/diff', { path: testDir, sha1: commit.sha1, file: testFile })
      });
  });
});
