const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const restGit = require('../source/git-api');
const common = require('./common-es6.js');
const mkdirp = require('mkdirp');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

let testDir;
let gitConfig;

const req = request(app);

const commitMessage = 'test';
const testFile = 'somefile';
const testFile2 = 'my test.txt';
const testSubDir = 'sub';
const testFile3 = path.join(testSubDir, 'testy.txt').replace('\\', '/');
const commitMessage3 = 'commit3';
const commitMessage4 = 'Removed some file';
const testFile4 = path.join(testSubDir, 'renamed.txt').replace(/\\/, '/');

describe('git-api', () => {
  before('creating test dir should work', () => {
    return common.post(req, '/testing/createtempdir').then((res) => {
      expect(res.path).to.be.ok();
      return fs.realpath(res.path).then((dir) => {
        testDir = dir;
      });
    });
  });

  after(() => common.post(req, '/testing/cleanup'));

  it('gitconfig should return config data', () => {
    return common.get(req, '/gitconfig', { path: testDir }).then((res) => {
      expect(res).to.be.an('object');
      expect(res['user.name']).to.be.ok();
      expect(res['user.email']).to.be.ok();
      gitConfig = res;
    });
  });

  it('status should fail in uninited directory', (done) => {
    req
      .get(`${restGit.pathPrefix}/status`)
      .query({ path: path.join(testDir, 'nowhere') })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end((err, res) => {
        expect(res.body.errorCode).to.be('no-such-path');
        done();
      });
  });

  it('quickstatus should say uninited in uninited directory', () => {
    return common
      .get(req, '/quickstatus', { path: testDir })
      .then((res) => expect(res).to.eql({ type: 'uninited', subRepos: [], gitRootPath: testDir }));
  });

  it('quickstatus should say uninited with sub repos if it has sub repos', () => {
    let testDirWithSubRepos;
    let subRepo1, subRepo2;

    return common
      .post(req, '/testing/createtempdir')
      .then((res) => {
        expect(res.path).to.be.ok();
        return fs.realpath(res.path).then((dir) => {
          testDirWithSubRepos = dir;
        });
      })
      .then(() => {
        subRepo1 = path.join(testDirWithSubRepos, 'repo1');
        return fs.mkdir(subRepo1).then(() => common.post(req, '/init', { path: subRepo1 }));
      })
      .then(() => {
        subRepo2 = path.join(testDirWithSubRepos, 'repo2');
        return fs.mkdir(subRepo2).then(() => common.post(req, '/init', { path: subRepo2 }));
      })
      .then(() => {
        return common.get(req, '/quickstatus', { path: testDirWithSubRepos }).then((res) =>
          expect(res).to.eql({
            type: 'uninited',
            subRepos: [subRepo1, subRepo2],
            gitRootPath: testDirWithSubRepos,
          })
        );
      });
  });

  it('status should fail in non-existing directory', () => {
    return common
      .get(req, '/status', { path: testDir })
      .catch((e) => expect(e.errorCode).to.be('no-such-path'));
  });

  it('quickstatus should say false in non-existing directory', () => {
    return common
      .get(req, '/quickstatus', { path: path.join(testDir, 'nowhere') })
      .then((res) =>
        expect(res).to.eql({ type: 'no-such-path', gitRootPath: path.join(testDir, 'nowhere') })
      );
  });

  it('init should succeed in uninited directory', () => {
    return common.post(req, '/init', { path: testDir });
  });

  it('status should succeed in inited directory', () => {
    return common.get(req, '/status', { path: testDir });
  });

  it('quickstatus should say inited in inited directory', () => {
    return common
      .get(req, '/quickstatus', { path: testDir })
      .then((res) => expect(res).to.eql({ type: 'inited', gitRootPath: testDir }));
  });

  it("commit should fail on when there's no files to commit", (done) => {
    req
      .post(`${restGit.pathPrefix}/commit`)
      .send({ path: testDir, message: 'test', files: [] })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(done);
  });

  // testFile

  it('log should be empty before first commit', () => {
    return common.get(req, '/gitlog', { path: testDir }).then((res) => {
      expect(res.nodes).to.be.a('array');
      expect(res.nodes.length).to.be(0);
    });
  });

  it('head should be empty before first commit', () => {
    return common.get(req, '/head', { path: testDir }).then((res) => {
      expect(res).to.be.a('array');
      expect(res.length).to.be(0);
    });
  });

  it('commit should fail on non-existing file', (done) => {
    req
      .post(`${restGit.pathPrefix}/commit`)
      .send({ path: testDir, message: 'test', files: [{ name: testFile }] })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(done);
  });

  it('creating test file should work', () => {
    return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile) });
  });

  it('status should list untracked file', () => {
    return common.get(req, '/status', { path: testDir }).then((res) => {
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile]).to.eql({
        displayName: testFile,
        fileName: testFile,
        oldFileName: testFile,
        isNew: true,
        staged: false,
        removed: false,
        conflict: false,
        renamed: false,
        type: 'text',
        additions: '-',
        deletions: '-',
      });
    });
  });

  // commitMessage

  it('commit should fail without commit message', (done) => {
    req
      .post(`${restGit.pathPrefix}/commit`)
      .send({ path: testDir, message: undefined, files: [{ name: testFile }] })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(done);
  });

  it("commit should succeed when there's files to commit", () => {
    return common.post(req, '/commit', {
      path: testDir,
      message: commitMessage,
      files: [{ name: testFile }],
    });
  });

  it('log should show latest commit', () => {
    return common.get(req, '/gitlog', { path: testDir }).then((res) => {
      expect(res.nodes).to.be.a('array');
      expect(res.nodes.length).to.be(1);
      expect(res.nodes[0].message.indexOf(commitMessage)).to.be(0);
      expect(res.nodes[0].authorName).to.be(gitConfig['user.name']);
      expect(res.nodes[0].authorEmail).to.be(gitConfig['user.email']);
    });
  });

  it('head should show latest commit', () => {
    return common.get(req, '/head', { path: testDir }).then((res) => {
      expect(res).to.be.a('array');
      expect(res.length).to.be(1);
      expect(res[0].message.indexOf(commitMessage)).to.be(0);
      expect(res[0].authorName).to.be(gitConfig['user.name']);
      expect(res[0].authorEmail).to.be(gitConfig['user.email']);
    });
  });

  it('modifying a test file should work', () => {
    return common.post(req, '/testing/changefile', { file: path.join(testDir, testFile) });
  });

  it('modified file should show up in status', () => {
    return common.get(req, '/status', { path: testDir }).then((res) => {
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile]).to.eql({
        displayName: testFile,
        fileName: testFile,
        oldFileName: testFile,
        isNew: false,
        staged: false,
        removed: false,
        conflict: false,
        renamed: false,
        type: 'text',
        additions: '1',
        deletions: '1',
      });
    });
  });

  it('discarding changes should work', () => {
    return common.post(req, '/discardchanges', { path: testDir, file: testFile });
  });

  it('modifying a test file should work part deux', () => {
    return common.post(req, '/testing/changefile', { file: path.join(testDir, testFile) });
  });

  it('commit ammend should work', () => {
    return common.post(req, '/commit', {
      path: testDir,
      message: commitMessage,
      files: [{ name: testFile }],
      amend: true,
    });
  });

  it('amend should not produce additional log-entry', () => {
    return common
      .get(req, '/gitlog', { path: testDir })
      .then((res) => expect(res.nodes.length).to.be(1));
  });

  // testFile2

  it('creating a multi word test file should work', () => {
    return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile2) });
  });

  it('status should list the new file', () => {
    return common.get(req, '/status', { path: testDir }).then((res) => {
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile2]).to.eql({
        displayName: testFile2,
        fileName: testFile2,
        oldFileName: testFile2,
        isNew: true,
        staged: false,
        removed: false,
        conflict: false,
        renamed: false,
        type: 'text',
        additions: '-',
        deletions: '-',
      });
    });
  });

  it('discarding the new file should work', (done) => {
    req
      .post(`${restGit.pathPrefix}/discardchanges`)
      .send({ path: testDir, file: testFile2 })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(done);
  });

  // testSubDir

  it('creating test sub dir should work', () => {
    return common.post(req, '/createdir', { dir: path.join(testDir, testSubDir) });
  });

  it('creating test multi layer dir should work', () => {
    return common.post(req, '/createdir', {
      dir: path.join(testDir, `${testSubDir}test/moretest/andmore`),
    });
  });

  // testFile3

  it('creating a test file in sub dir should work', () => {
    return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile3) });
  });

  it('status should list the new file once again', () => {
    return common.get(req, '/status', { path: testDir }).then((res) => {
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile3]).to.eql({
        displayName: testFile3,
        fileName: testFile3,
        oldFileName: testFile3,
        isNew: true,
        staged: false,
        removed: false,
        conflict: false,
        renamed: false,
        type: 'text',
        additions: '-',
        deletions: '-',
      });
    });
  });

  // commitMessage3

  it('commit should succeed with file in sub dir', () => {
    return common.post(req, '/commit', {
      path: testDir,
      message: commitMessage3,
      files: [{ name: testFile3 }],
    });
  });

  it('log should show last commit', () => {
    return common.get(req, '/gitlog', { path: testDir }).then((res) => {
      expect(res.nodes).to.be.a('array');
      expect(res.nodes.length).to.be(2);
      const HEAD = res.nodes[0];

      expect(HEAD.message.indexOf(commitMessage3)).to.be(0);
      expect(HEAD.authorDate).to.be.a('string');
      expect(HEAD.authorName).to.be(gitConfig['user.name']);
      expect(HEAD.authorEmail).to.be(gitConfig['user.email']);
      expect(HEAD.commitDate).to.be.a('string');
      expect(HEAD.committerName).to.be(gitConfig['user.name']);
      expect(HEAD.committerEmail).to.be(gitConfig['user.email']);
      expect(HEAD.sha1).to.be.ok();
    });
  });

  it('removing a test file should work', () => {
    return common.post(req, '/testing/removefile', { file: path.join(testDir, testFile) });
  });

  it('status should list the removed file', () => {
    return common.get(req, '/status', { path: testDir }).then((res) => {
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile]).to.eql({
        displayName: testFile,
        fileName: testFile,
        oldFileName: testFile,
        isNew: false,
        staged: false,
        removed: true,
        conflict: false,
        renamed: false,
        type: 'text',
        additions: '0',
        deletions: '2',
      });
    });
  });

  // commitMessage4

  it('commit on removed file should work', () => {
    return common.post(req, '/commit', {
      path: testDir,
      message: commitMessage4,
      files: [{ name: testFile }],
    });
  });

  it('status should list nothing', () => {
    return common
      .get(req, '/status', { path: testDir })
      .then((res) => expect(Object.keys(res.files).length).to.be(0));
  });

  // testFile4

  it('renaming a file should work', () => {
    return common.post(req, '/testing/git', {
      path: testDir,
      command: ['mv', testFile3, testFile4],
    });
  });

  it('status should list the renamed file', () => {
    return common.get(req, '/status', { path: testDir }).then((res) => {
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile4]).to.eql({
        displayName: `${testFile3} → ${testFile4}`,
        fileName: testFile4,
        oldFileName: testFile3,
        isNew: false,
        staged: false,
        removed: false,
        conflict: false,
        renamed: true,
        type: 'text',
        additions: '0',
        deletions: '0',
      });
    });
  });

  it('log with limit should only return specified number of items', () => {
    return common.get(req, '/gitlog', { path: testDir, limit: 1 }).then((res) => {
      expect(res.nodes).to.be.a('array');
      expect(res.nodes.length).to.be(1);
    });
  });

  it('get the baserepopath without base repo should work', (done) => {
    const baseRepoPathTestDir = path.join(testDir, 'depth1', 'depth2');

    mkdirp(baseRepoPathTestDir).then(() => {
      return common.get(req, '/baserepopath', { path: baseRepoPathTestDir }).then((res) => {
        // Some oses uses symlink and path will be different as git will return resolved symlink
        expect(res.path).to.contain(testDir);
        done();
      });
    });
  });

  it('test gitignore api endpoint', () => {
    return common
      .put(req, '/gitignore', { path: testDir, data: 'abc' })
      .then(() => common.get(req, '/gitignore', { path: testDir }))
      .then((res) => expect(res.content).to.be('abc'))
      .then(() => common.put(req, '/gitignore', { path: testDir, data: '' }))
      .then(() => common.get(req, '/gitignore', { path: testDir }))
      .then((res) => expect(res.content).to.be(''));
  });
});
