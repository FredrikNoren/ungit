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

describe('git-api submodule', function () {
  let testDirMain, testDirSecondary;

  before(() => {
    return common
      .createSmallRepo(req)
      .then((dir) => {
        testDirMain = dir;
      })
      .then(() => common.createSmallRepo(req))
      .then((dir) => {
        testDirSecondary = dir;
      });
  });

  after(() => common.post(req, '/testing/cleanup'));

  const submodulePath = 'sub';

  it('submodule add should work', () => {
    return common.post(req, '/submodules/add', {
      path: testDirMain,
      submodulePath: submodulePath,
      submoduleUrl: testDirSecondary,
    });
  });

  it('submodule should show up in status', () => {
    return common.get(req, '/status', { path: testDirMain }).then((res) => {
      expect(Object.keys(res.files).length).to.be(2);
      expect(res.files[submodulePath]).to.eql({
        displayName: submodulePath,
        fileName: submodulePath,
        oldFileName: submodulePath,
        isNew: true,
        staged: true,
        removed: false,
        conflict: false,
        renamed: false,
        type: 'text',
        additions: '1',
        deletions: '0',
      });
      expect(res.files['.gitmodules']).to.eql({
        displayName: '.gitmodules',
        fileName: '.gitmodules',
        oldFileName: '.gitmodules',
        isNew: true,
        staged: true,
        removed: false,
        conflict: false,
        renamed: false,
        type: 'text',
        additions: '3',
        deletions: '0',
      });
    });
  });

  it('commit should succeed', () => {
    return common.post(req, '/commit', {
      path: testDirMain,
      message: 'Add submodule',
      files: [{ name: submodulePath }, { name: '.gitmodules' }],
    });
  });

  it('status should be empty after commit', () => {
    return common
      .get(req, '/status', { path: testDirMain })
      .then((res) => expect(Object.keys(res.files).length).to.be(0));
  });

  it('creating a test file in sub dir should work', () => {
    const testFile = path.join(submodulePath, 'testy.txt');
    return common.post(req, '/testing/createfile', { file: path.join(testDirMain, testFile) });
  });

  // see https://github.com/FredrikNoren/ungit/issues/1472
  it.skip("submodule should show up in status when it's dirty", () => {
    return common.get(req, '/status', { path: testDirMain }).then((res) => {
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[submodulePath]).to.eql({
        displayName: submodulePath,
        fileName: submodulePath,
        oldFileName: submodulePath,
        isNew: false,
        staged: false,
        removed: false,
        conflict: false,
        renamed: false,
        type: 'text',
        additions: '0',
        deletions: '0',
      });
    });
  });

  // see https://github.com/FredrikNoren/ungit/issues/1472
  it.skip('diff on submodule should work', () => {
    return common.get(req, '/diff', { path: testDirMain, file: submodulePath }).then((res) => {
      expect(res.indexOf('-Subproject commit')).to.be.above(-1);
      expect(res.indexOf('+Subproject commit')).to.be.above(-1);
    });
  });
});
