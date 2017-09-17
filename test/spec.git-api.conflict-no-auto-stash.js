const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../src/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());
const req = request(app);

restGit.registerApi({ app: app, config: { dev: true, autoStashAndPop: false } });

let testDir;

describe('git-api conflict checkout no auto stash', function () {
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
  after(() => {
    return common.post(req, '/testing/cleanup')
  });

  it('should be possible to make some changes', () => {
    return common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) });
  });

  it('should not be possible to checkout with local files that will conflict', () => {
    return common.post(req, `${restGit.pathPrefix}/checkout`, { path: testDir, name: testBranch })
      .then((gitErr) => expect(gitErr.errorCode).to.be('local-changes-would-be-overwritten'));
  });

  it('checkout should say we are still on master', () => {
    return common.get(req, '/checkout', { path: testDir })
      .then((res) => expect(res).to.be('master'));
  });
});
