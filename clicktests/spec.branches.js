'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

describe('[BRANCHES]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: false }]);
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.openUngit(testRepoPaths[0]);
  });

  it('add a commit', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/testfile.txt`, testRepoPaths[0]);
    await environment.commit('commit-1');
  });

  // < branch search test >
  it('add branches', async () => {
    await environment.createBranch('search-1');
    await environment.createBranch('search-2');
    await environment.createBranch('search-3');
    await environment.createBranch('search-4');
    await environment.waitForElementVisible('[data-ta-name="search-4"]');
  });

  it('add tag should make one of the branch disappear', async () => {
    await environment.createTag('tag-1');
    await environment.waitForElementHidden('[data-ta-name="search-4"]');
  });

  it('search for the hidden branch', async () => {
    await environment.wait(1000); // sleep to avoid `git-directory-changed` event, which refreshes git nodes and closes search box
    await environment.click('.showSearchForm');

    await environment.type('-4');
    await environment.wait(500);
    await environment.press('ArrowDown');
    await environment.press('Enter');

    await environment.waitForElementVisible('[data-ta-name="search-4"]');
  });

  it('updateBranches button without branches', async () => {
    await environment.click('.btn-group.branch .btn-main');
    await environment.waitForElementHidden('#nprogress');
  });

  it('add a branch', () => {
    return environment.createBranch('branch-1');
  });

  it('updateBranches button with one branch', async () => {
    await environment.click('.btn-group.branch .btn-main');
    await environment.waitForElementHidden('#nprogress');
  });

  it('add second branch', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/testfile2.txt`, testRepoPaths[0]);
    await environment.commit('commit-2');

    await environment.createBranch('branch-2');
    await environment.createBranch('branch-3');
  });

  it('Check out a branch via selection', async () => {
    await environment.click('.branch .dropdown-toggle');
    await environment.click('[data-ta-clickable="checkoutrefs/heads/branch-2"]');
    await environment.waitForElementVisible('[data-ta-name="branch-2"].current');
  });

  it('Delete a branch via selection', async () => {
    await environment.click('.branch .dropdown-toggle');
    await environment.click('[data-ta-clickable="refs/heads/branch-3-remove"]');
    await environment.click('.modal-dialog .btn-primary');
    await environment.waitForElementHidden('#nprogress');
  });

  it('add another commit', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/testfile2.txt`, testRepoPaths[0]);
    await environment.commit('commit-3');
  });

  it('checkout cherypick base', async () => {
    await environment.click('.branch .dropdown-toggle');
    await environment.click('[data-ta-clickable="checkoutrefs/heads/branch-1"]');
    await environment.waitForElementVisible('[data-ta-name="branch-1"].current');
    await environment.waitForElementHidden('#nprogress');
  });

  it('cherrypick fail case', async () => {
    await environment.click('[data-ta-clickable="node-clickable-0"]');
    await environment.click(
      '[data-ta-action="cherry-pick"]:not([style*="display: none"]) .dropmask'
    );

    await environment.click('.staging .btn-stg-abort');
    await environment.click('.modal-dialog .btn-primary');

    await environment.waitForElementVisible('[data-ta-clickable="node-clickable-0"]'); // wait for nodes to come back
  });

  it('cherrypick success case', async () => {
    await environment.click('[data-ta-clickable="node-clickable-1"]');
    await environment.click(
      '[data-ta-action="cherry-pick"]:not([style*="display: none"]) .dropmask'
    );
    await environment.waitForElementVisible('[data-ta-node-title="commit-2"] .ref.branch.current');
  });

  it('test backward squash from own lineage', async () => {
    await environment.click('.ref.branch.current');
    await environment.click('[data-ta-node-title="commit-1"] .squash .dropmask');
    await environment.waitForElementVisible('.staging .files .file');
    await environment.click('.files button.discard');
    await environment.click('.modal-dialog .btn-primary');
    await environment.waitForElementHidden('.staging .files .file');
  });

  it('test forward squash from different lineage', async () => {
    await environment.click('.ref.branch.current');
    await environment.click('[data-ta-node-title="commit-3"] .squash .dropmask');
    await environment.waitForElementVisible('.staging .files .file');
  });

  it('Auto checkout on branch creation.', async () => {
    await environment.page.evaluate(() => (ungit.config.autoCheckoutOnBranchCreate = true));
    await environment.createBranch('autoCheckout');
    await environment.waitForElementVisible('[data-ta-name="autoCheckout"].current');
  });
});
