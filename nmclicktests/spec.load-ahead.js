'use strict';
const environment = require('./environment')({ serverStartupOptions: ['--numberOfNodesPerLoad=1'] });
const testRepoPaths = [];

describe('[LOAD-AHEAD]', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false }]));
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[0]);
  });

  it('Should be possible to create and commit 1', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.commit('commit-1')
      .wait('.commit')
      .ug.createBranch('branch-1');
  });

  it('Should be possible to create and commit 2', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.commit('commit-2')
      .wait('.commit');
  });

  it('Should be possible to create and commit 3', () => {
    return environment.nm.ug.click('.branch .dropdown-toggle')
      .wait('[data-ta-clickable="checkoutbranch-1"]')
      .wait(500)
      .ug.click('[data-ta-clickable="checkoutbranch-1"]')
      .ug.waitForElementNotVisible('.branch .progress');
  });

  it('Open path screen again and should see only 1 commit', () => {
    return environment.nm.refresh()
      .wait('.loadAhead')
      .ug.waitForElementNotVisible('[data-ta-clickable="node-clickable-1"]');
  });

  it('Create a branch during collapsed mode', () => {
    return environment.nm.ug.createBranch('new-branch');
  });

  it('Load ahead', () => {
    return environment.nm.ug.click('.load-ahead-button')
      .wait('[data-ta-clickable="node-clickable-1"]')
      .ug.waitForElementNotVisible('.loadAhead')
  });
});
