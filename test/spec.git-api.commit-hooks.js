const request = require('supertest');
const expect = require('expect.js');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const restGit = require('../source/git-api');
const git = require('../source/git-promise');
const common = require('./common-es6');

const app = express();
app.use(require('body-parser').json());
restGit.registerApi({ app, config: { dev: true } });
const req = request(app);

describe('git-api commit hooks', () => {
  after(() => common.post(req, '/testing/cleanup'));

  for (const hook of ['pre-commit', 'prepare-commit-msg', 'commit-msg']) {
    it(`skips ${hook} only for the requested commit`, async () => {
      const repoPath = await common.createSmallRepo(req);
      const hooksPath = path.join(repoPath, 'custom-hooks');
      await fs.mkdir(hooksPath);
      await fs.writeFile(path.join(hooksPath, hook), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
      await git(['config', 'core.hooksPath', hooksPath], repoPath);
      const payload = { path: repoPath, message: 'Hook test', emptyCommit: true, files: [] };
      await req.post(`${restGit.pathPrefix}/commit`).send(payload).expect(400);
      await req
        .post(`${restGit.pathPrefix}/commit`)
        .send({ ...payload, skipHooks: true })
        .expect(200);
      await req.post(`${restGit.pathPrefix}/commit`).send(payload).expect(400);
      await req
        .post(`${restGit.pathPrefix}/commit`)
        .send({ ...payload, skipHooks: 'true' })
        .expect(400);
    });
  }

  it('also skips post-commit hooks without disabling later hooks', async () => {
    const repoPath = await common.createSmallRepo(req);
    const marker = path.join(repoPath, 'hook-ran');
    await fs.writeFile(
      path.join(repoPath, '.git', 'hooks', 'post-commit'),
      '#!/bin/sh\nprintf ran > hook-ran\n',
      { mode: 0o755 }
    );
    const payload = { path: repoPath, message: 'Post hook test', emptyCommit: true, files: [] };
    await req.post(`${restGit.pathPrefix}/commit`).send(payload).expect(200);
    expect(await fs.readFile(marker, 'utf8')).to.be('ran');
    await fs.unlink(marker);
    await req
      .post(`${restGit.pathPrefix}/commit`)
      .send({ ...payload, skipHooks: true })
      .expect(200);
    expect(
      await fs.access(marker).then(
        () => true,
        () => false
      )
    ).to.be(false);
    await req.post(`${restGit.pathPrefix}/commit`).send(payload).expect(200);
    expect(await fs.readFile(marker, 'utf8')).to.be('ran');
  });
});
