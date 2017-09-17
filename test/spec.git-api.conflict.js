const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../src/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true, autoStashAndPop: true } });

let testDir;

const req = request(app);

describe('git-api conflict rebase', function () {
  this.timeout(8000);

  const commitMessage = 'Commit 1';
  const testFile1 = "testfile1.txt";
  const testBranch = 'testBranch';

  before(() => {
    return common.initRepo(req).then((dir) => {
      testDir = dir;

      return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) })
        .then(() => common.post(req, '/commit', { path: testDir, message: commitMessage, files: [{ name: testFile1 }] }))
        .then(() => common.post(req, '/branches', { path: testDir, name: testBranch, startPoint: 'master' }))
        .then(() => common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }))
        .then(() => common.post(req, '/commit', { path: testDir, message: commitMessage, files: [{ name: testFile1 }] }))
        .then(() => common.post(req, '/checkout', { path: testDir, name: testBranch }))
        .then(() => common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }))
        .then(() => common.post(req, '/commit', { path: testDir, message: commitMessage, files: [{ name: testFile1 }] }))
    });
  });

  it('should be possible to rebase on master', (done) => {
    req
      .post(`${restGit.pathPrefix}/rebase`)
      .send({ path: testDir, onto: 'master' })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end((err, res) => {
        expect(res.body.errorCode).to.be('merge-failed');
        done();
      });
  });

  it('status should list files in conflict', () => {
    return common.get(req, '/status', { path: testDir }).then((res) => {
      expect(res.inRebase).to.be(true);
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile1]).to.eql({
        displayName: testFile1,
        isNew: false,
        staged: false,
        removed: false,
        conflict: true,
        renamed: false,
        type: 'text',
        additions: '4',
        deletions: '0'
      });
    });
  });

  it('should be possible fix the conflict', () => {
    return common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) });
  });

  it('should be possible to resolve', () => {
    return common.post(req, '/resolveconflicts', { path: testDir, files: [testFile1] });
  });

  it('should be possible continue the rebase', () => {
    return common.post(req, '/rebase/continue', { path: testDir });
  });

})

describe('git-api conflict checkout', function() {
  this.timeout(8000);

  const testBranch = 'testBranch';
  const testFile1 = "testfile1.txt";

  before(() => {
    return common.initRepo(req).then((dir) => {
      testDir = dir;
      return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) })
        .then(() => common.post(req, '/commit', { path: testDir, message: 'a', files: [{ name: testFile1 }] }))
        .then(() => common.post(req, '/branches', { path: testDir, name: testBranch, startPoint: 'master' }))
        .then(() => common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }))
        .then(() => common.post(req, '/commit', { path: testDir, message: 'b', files: [{ name: testFile1 }] }))
    });
  });

  it('should be possible to make some changes', () => {
    return common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) });
  });

  it('should be possible to checkout with local files that will conflict', (done) => {
    req
      .post(`${restGit.pathPrefix}/checkout`)
      .send({ path: testDir, name: testBranch })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end((err, res) => {
        expect(res.body.errorCode).to.be('merge-failed');
        done();
      });
  });

  it('status should list files in conflict', () => {
    return common.get(req, '/status', { path: testDir }).then((res) => {
      expect(res.inRebase).to.be(false);
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile1]).to.eql({
        displayName: testFile1,
        isNew: false,
        staged: false,
        removed: false,
        conflict: true,
        renamed: false,
        type: 'text',
        additions: '4',
        deletions: '0'
      });
    });
  });

});


describe('git-api conflict merge', function () {
  this.timeout(8000);

  const testBranch = 'testBranch1';
  const testFile1 = "testfile1.txt";

  before(() => {
    return common.initRepo(req).then((dir) => {
      testDir = dir;
      return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) })
        .then(() => common.post(req, '/commit', { path: testDir, message: 'a', files: [{ name: testFile1 }] }))
        .then(() => common.post(req, '/branches', { path: testDir, name: testBranch, startPoint: 'master' }))
        .then(() => common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }))
        .then(() => common.post(req, '/commit', { path: testDir, message: 'b', files: [{ name: testFile1 }] }))
        .then(() => common.post(req, '/checkout', { path: testDir, name: testBranch }))
        .then(() => common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }))
        .then(() => common.post(req, '/commit', { path: testDir, message: 'c', files: [{ name: testFile1 }] }))
    });
  });

  it('should be possible to merge the branches', (done) => {
    req
      .post(`${restGit.pathPrefix}/merge`)
      .send({ path: testDir, with: 'master' })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end((err, res) => {
        expect(res.body.errorCode).to.be('merge-failed');
        done();
      });
  });

  it('status should list files in conflict', () => {
    return common.get(req, '/status', { path: testDir }).then((res) => {
      expect(res.inMerge).to.be(true);
      expect(res.commitMessage).to.be.ok();
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile1]).to.eql({
        displayName: testFile1,
        isNew: false,
        staged: false,
        removed: false,
        conflict: true,
        renamed: false,
        type: 'text',
        additions: '4',
        deletions: '0'
      });
    });
  });

  it('should be possible fix the conflict', () => {
    return common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) });
  });

  it('should be possible to resolve', () => {
    return common.post(req, '/resolveconflicts', { path: testDir, files: [testFile1] });
  });

  it('should be possible continue the merge', () => {
    return common.post(req, '/merge/continue', { path: testDir, message: 'something' });
  });

});


describe('git-api conflict solve by deleting', function () {

  this.timeout(8000);

  const commitMessage = 'Commit 1';
  const testFile1 = "testfile1.txt";
  const testBranch = 'testBranch';

  before(() => {
    return common.initRepo(req).then((dir) => {
      testDir = dir;

      return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) })
        .then(() => common.post(req, '/commit', { path: testDir, message: commitMessage, files: [{ name: testFile1 }] }))
        .then(() => common.post(req, '/branches', { path: testDir, name: testBranch, startPoint: 'master' }))
        .then(() => common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }))
        .then(() => common.post(req, '/commit', { path: testDir, message: commitMessage, files: [{ name: testFile1 }] }))
        .then(() => common.post(req, '/checkout', { path: testDir, name: testBranch }))
        .then(() => common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) }))
        .then(() => common.post(req, '/commit', { path: testDir, message: commitMessage, files: [{ name: testFile1 }] }))
    });
  });

  it('should be possible to rebase on master', (done) => {
    req
      .post(`${restGit.pathPrefix}/rebase`)
      .send({ path: testDir, onto: 'master' })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end((err, res) => {
        expect(res.body.errorCode).to.be('merge-failed');
        done();
      });
  });

  it('status should list files in conflict', () => {
    return common.get(req, '/status', { path: testDir }).then((res) => {
      expect(res.inRebase).to.be(true);
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile1]).to.eql({
        displayName: testFile1,
        isNew: false,
        staged: false,
        removed: false,
        conflict: true,
        renamed: false,
        type: 'text',
        additions: '4',
        deletions: '0'
      });
    });
  });

  it('should be possible to remove the file', () => {
    return common.post(req, '/testing/removefile', { file: path.join(testDir, testFile1) });
  });

  it('should be possible to resolve', () => {
    return common.post(req, '/resolveconflicts', { path: testDir, files: [testFile1] });
  });

  it('should be possible continue the rebase', () => {
    return common.post(req, '/rebase/continue', { path: testDir });
  });

  after(() => {
    return common.post(req, '/testing/cleanup', undefined);
  });

});
