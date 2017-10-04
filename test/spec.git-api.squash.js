const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../src/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

let testDir;

const req = request(app);
const rootBranch = 'root'
const branch1 = 'branch1'
const branch2 = 'branch2'

const testFile1 = 'testFile1.txt'
const testFile2 = 'testFile2.txt'

describe('git-api conflict rebase', function () {
  this.timeout(8000);

  before(() => {
    return common.createSmallRepo(req)
      .then((dir) => { testDir = dir });
  });

  after(() => common.post(req, '/testing/cleanup'));

  it('establish root branch', () => {
    return common.post(req, '/branches', { path: testDir, name: rootBranch, startPoint: 'master' });
  });

  it('create some commits', () => {
    return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) })
      .then(() => common.post(req, '/commit', { path: testDir, message: `a commit for ${testFile1}`, files: [{ name: testFile1 }] }))
      .then(() => common.post(req, '/testing/createfile', { file: path.join(testDir, testFile2) }))
      .then(() => common.post(req, '/commit', { path: testDir, message: `a commit for ${testFile2}`, files: [{ name: testFile2 }] }))
  });

  it('checkout master', () => {
    return common.post(req, '/checkout', { path: testDir, name: rootBranch });
  });

  it('squash 2 commits to 1', () => {
    return common.post(req, '/squash', { path: testDir, target: 'master' })
      .then(() => common.get(req, '/status', { path: testDir }))
      .then((res) => expect(Object.keys(res.files).length).to.be(2));
  });

  it('discard all', () => {
    return common.post(req, '/discardchanges', { path: testDir, all: true })
      .then(() => common.get(req, '/status', { path: testDir }))
      .then((res) => expect(Object.keys(res.files).length).to.be(0));
  });

  it('making conflicting commit', () => {
    return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) })
      .then(() => common.post(req, '/commit', { path: testDir, message: `a 2nd commit for ${testFile1}`, files: [{ name: testFile1 }] }))
  });

  it('squash 2 commits to 1 with conflict', () => {
    return common.post(req, '/squash', { path: testDir, target: 'master' })
      .then(() => common.get(req, '/status', { path: testDir }))
      .then((res) => {
        expect(res.inConflict).to.be(true);
        expect(Object.keys(res.files).length).to.be(2);
      });
  });
});
