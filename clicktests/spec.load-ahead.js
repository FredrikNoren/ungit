'use strict';
const environment = require('./environment')({
  serverStartupOptions: ['--numberOfNodesPerLoad=1'],
});
const testRepoPaths = [];

describe('[LOAD-AHEAD]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: false }]);
  });

  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.openUngit(testRepoPaths[0]);
  });

  it('Should be possible to create and commit 1', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/testfile.txt`, testRepoPaths[0]);
    await environment.commit('commit-1');
    await environment.createBranch('branch-1');
  });

  it('Should be possible to create and commit 2', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/testfile.txt`, testRepoPaths[0]);
    await environment.commit('commit-2');
  });

  it('Should be possible to create and commit 3', async () => {
    await environment.click('.branch .dropdown-toggle');
    await environment.click('[data-ta-clickable="checkoutrefs/heads/branch-1"]');
    await environment.waitForElementVisible('[data-ta-name="branch-1"].current');
  });

  it('Create a branch during collapsed mode', () => {
    return environment.createBranch('new-branch');
  });

  it('Load ahead', async () => {
    await environment.click('.load-ahead-button');
    await environment.waitForElementVisible('[data-ta-clickable="node-clickable-1"]');
    await environment.waitForElementHidden('.loadAhead');
  });
});
