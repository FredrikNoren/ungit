const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../source/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

const req = request(app);

describe('git-api diff', () => {
  let testDir, testBareDir;

  before(() => {
    return common
      .initRepo(req)
      .then((dir) => (testDir = dir))
      .then(() => common.initRepo(req, { bare: true }))
      .then((dir) => (testBareDir = dir));
  });

  after(() => common.post(req, '/testing/cleanup', undefined));

  const testFile = 'afile.txt';
  const testFile2 = 'anotherfile.txt';
  const testImage = 'icon.png';

  it('diff on non existing file should fail', () => {
    return common.get(req, '/diff', { path: testDir, file: testFile });
  });

  let content;

  it('should be possible to create a file', () => {
    content = ['A', 'few', 'lines', 'of', 'content', ''];

    return common.post(req, '/testing/createfile', {
      file: path.join(testDir, testFile),
      content: content.join('\n'),
    });
  });

  it('should be possible to create an image file', () => {
    return common.post(req, '/testing/createimagefile', { file: path.join(testDir, testImage) });
  });

  it('diff on created file should work', () => {
    return common.get(req, '/diff', { path: testDir, file: testFile }).then((res) => {
      for (let i = 0; i < content.length; i++) {
        expect(res.indexOf(content[i])).to.be.above(-1);
      }
    });
  });

  it('diff on image file should work', () => {
    return common
      .getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' })
      .then((res) => expect(res.toString()).to.be('png'));
  });

  it('should be possible to commit a file', () => {
    return common.post(req, '/commit', {
      path: testDir,
      message: 'Init File',
      files: [{ name: testFile }],
    });
  });

  it('should be possible to commit an image file', () => {
    return common.post(req, '/commit', {
      path: testDir,
      message: 'Init Image',
      files: [{ name: testImage }],
    });
  });

  it('diff on first commit should work', () => {
    return common
      .get(req, '/gitlog', { path: testDir })
      .then((res) => {
        expect(res.nodes.length).to.be(2);
        return common.get(req, '/diff', { path: testDir, file: testFile, sha1: res.nodes[1].sha1 });
      })
      .then((res) => {
        for (let i = 0; i < content.length; i++) {
          expect(res.indexOf(content[i])).to.be.above(-1);
        }
      });
  });

  it('diff on commited file should work', () => {
    return common.get(req, '/diff', { path: testDir, file: testFile }).then((res) => {
      expect(res).to.be.an('array');
      expect(res.length).to.be(0);
    });
  });

  it('diff on commited image file should work', () => {
    return common
      .getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' })
      .then((res) => expect(res.toString()).to.be('png'));
  });

  it('should be possible to modify a file', () => {
    content.splice(2, 0, 'more');
    return common.post(req, '/testing/changefile', {
      file: path.join(testDir, testFile),
      content: content.join('\n'),
    });
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

  it('diff on file commit should work if file is changing', () => {
    return common
      .get(req, '/gitlog', { path: testDir })
      .then((res) => {
        expect(res.nodes.length).to.be(2);
        return common.get(req, '/diff', { path: testDir, file: testFile, sha1: res.nodes[1].sha1 });
      })
      .then((res) => {
        expect(res.indexOf('diff --git a/afile.txt b/afile.txt')).to.be.above(-1);
        expect(res.indexOf('+more')).to.be(-1);
      });
  });

  it('getting current image file should work', () => {
    return common
      .getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' })
      .then((res) => expect(res.toString()).to.be('png ~~'));
  });

  it('getting previous image file should work', () => {
    return common
      .getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'HEAD' })
      .then((res) => expect(res.toString()).to.be('png'));
  });

  it('should be possible to rename a modified file', () => {
    return common.post(req, '/testing/git', {
      path: testDir,
      command: ['mv', testFile, testFile2],
    });
  });

  it('diff on renamed and modified file should work', () => {
    return common
      .get(req, '/diff', { path: testDir, file: testFile2, oldFile: testFile })
      .then((res) => {
        expect(res.indexOf('diff --git a/afile.txt b/anotherfile.txt')).to.be.above(-1);
        expect(res.indexOf('+more')).to.be.above(-1);
      });
  });

  it('should be possible to commit the renamed and modified file', () => {
    return common.post(req, '/commit', {
      path: testDir,
      message: 'Move and Change',
      files: [{ name: testFile2 }],
    });
  });

  it('diff on commit with renamed and modified file should work', () => {
    return common
      .get(req, '/gitlog', { path: testDir })
      .then((res) => {
        expect(res.nodes.length).to.be(3);
        return common.get(req, '/diff', {
          path: testDir,
          file: testFile2,
          oldFile: testFile,
          sha1: res.nodes[0].sha1,
        });
      })
      .then((res) => {
        for (let i = 0; i < content.length; i++) {
          expect(res.indexOf(content[i])).to.be.above(-1);
        }
      });
  });

  it('removing a test file should work', () => {
    return common.post(req, '/testing/removefile', { file: path.join(testDir, testFile2) });
  });

  it('should be possible to commit an image file for removal', () => {
    return common.post(req, '/commit', {
      path: testDir,
      message: 'Init',
      files: [{ name: testImage }],
    });
  });

  it('removing a test image file should work', () => {
    return common.post(req, '/testing/removefile', { file: path.join(testDir, testImage) });
  });

  it('diff on removed file should work', () => {
    return common.get(req, '/diff', { path: testDir, file: testFile2 }).then((res) => {
      expect(res.indexOf('deleted file')).to.be.above(-1);
      expect(res.indexOf('@@ -1,6 +0,0 @@')).to.be.above(-1);
    });
  });

  it('getting previous image file should work after removal', () => {
    return common
      .getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'HEAD' })
      .then((res) => expect(res.toString()).to.be('png ~~'));
  });

  it('diff on bare repository file should work', () => {
    // first add remote and push all commits
    return common
      .post(req, '/remotes/barerepository', { path: testDir, url: testBareDir })
      .then(() => common.post(req, '/push', { path: testDir, remote: 'barerepository' }))
      .then(() => common.get(req, '/gitlog', { path: testDir }))
      .then((res) => {
        // find a commit which contains the testFile
        const commit = res.nodes.filter((commit) =>
          commit.fileLineDiffs.some((lineDiff) => lineDiff.fileName == testFile)
        )[0];
        return common.get(req, '/diff', { path: testDir, sha1: commit.sha1, file: testFile });
      });
  });
});
