const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../source/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

let testDir;

const req = request(app);

describe('git-api conflict rebase', function () {
  this.timeout(8000);

  const testFile1 = 'testfile1.txt';

  before(async () => {
    await common.createSmallRepo(req).then((dir) => {
      testDir = dir;
    });

    return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) });
  });

  after(() => common.post(req, '/testing/cleanup'));

  it('should be possible to stash', () => common.post(req, '/stashes', { path: testDir }));

  it('stashes should list the stashed item', async () => {
    const res = await common.get(req, '/stashes', { path: testDir });
    expect(res.length).to.be(1);
    expect(res[0].reflogId).to.be('0');
    expect(res[0].reflogName).to.be('stash@{0}');
  });

  it('should be possible to drop stash', () => {
    return common.delete(req, '/stashes/0', { path: testDir });
  });
});
