const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const restGit = require('../source/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

const req = request(app);

describe('git-api: test ignorefile call', () => {
  after(() => common.post(req, '/testing/cleanup'));

  it('Add a file to .gitignore file through api call', async () => {
    const dir = await common.createSmallRepo(req);
    const testFile = 'test.txt';

    await fs.writeFile(path.join(dir, '.gitignore'), 'test git ignore file...');

    await common.post(req, '/testing/createfile', { file: path.join(dir, testFile) });

    // Create .gitignore file prior to append
    await common.post(req, '/ignorefile', { path: dir, file: testFile });

    const res = await common.get(req, '/status', { path: dir });
    expect(Object.keys(res.files).toString()).to.be('.gitignore');

    const data = await fs.readFile(path.join(dir, '.gitignore'));
    if (data.toString().indexOf(testFile) < 0) {
      throw new Error('Test file is not added to the .gitignore file.');
    }
  });

  it('Add a file to .gitignore file through api call when .gitignore is missing', async () => {
    const dir = await common.createSmallRepo(req);
    const testFile = 'test.txt';

    await common.post(req, '/testing/createfile', { file: path.join(dir, testFile) });

    await common.post(req, '/ignorefile', { path: dir, file: testFile });
    const res = await common.get(req, '/status', { path: dir });
    expect(Object.keys(res.files).toString()).to.be('.gitignore');

    const data = await fs.readFile(path.join(dir, '.gitignore'));
    if (data.toString().indexOf(testFile) < 0) {
      throw new Error('Test file is not added to the .gitignore file.');
    }
  });

  it('Attempt to add a file where similar name alread exist in .gitignore through api call', async () => {
    const dir = await common.createSmallRepo(req);
    const testFile = 'test.txt';

    await fs.appendFile(path.join(dir, '.gitignore'), testFile.split('.')[0]);

    await common.post(req, '/testing/createfile', { file: path.join(dir, testFile) });

    // add part of file name to gitignore
    await common.post(req, '/ignorefile', { path: dir, file: testFile });

    const res = await common.get(req, '/status', { path: dir });
    expect(Object.keys(res.files).toString()).to.be('.gitignore');

    const data = await fs.readFile(path.join(dir, '.gitignore'));
    if (data.toString().indexOf(testFile) < 0) {
      throw new Error('Test file is not added to the .gitignore file.');
    }
  });
});
