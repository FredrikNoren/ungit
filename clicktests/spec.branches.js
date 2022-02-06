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
    await environment.stopProgramEventPropagation();
    await environment.waitForNetworkIdle();
    await environment.click('.showSearchForm');
    await environment.type('-4');
    await environment.waitForElementVisible('.branch-search');
    await environment.page.waitForFunction(
      'document.querySelectorAll(".ui-menu-item-wrapper").length > 0 && document.querySelectorAll(".ui-menu-item-wrapper")[0].text.trim() === "search-4"'
    );
    await environment.press('ArrowDown');
    await environment.press('Enter');

    await environment.waitForElementVisible('[data-ta-name="search-4"]', 10000);
    await environment.startProgramEventPropagation();
  });

  it('updateBranches button without branches', async () => {
    await environment.setApiListener('/branches?', 'GET', 'ungit.__branchesGetResponded');
    await environment.setApiListener('/refs?', 'GET', 'ungit.__refsGetResponded');
    await environment.click('.btn-group.branch .btn-main');
    await environment.page.waitForFunction('ungit.__branchesGetResponded');
    await environment.page.waitForFunction('ungit.__refsGetResponded');
  });

  it('add a branch', () => {
    return environment.createBranch('branch-1');
  });

  it('updateBranches button with one branch', async () => {
    await environment.page.evaluate('ungit.__branchesGetResponded = undefined');
    await environment.page.evaluate('ungit.__refsGetResponded = undefined');
    await environment.click('.btn-group.branch .btn-main');
    await environment.page.waitForFunction('ungit.__branchesGetResponded');
    await environment.page.waitForFunction('ungit.__refsGetResponded');
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
    await environment.setApiListener('/branches?', 'DELETE', 'ungit.__branchDeleteResponed');
    await environment.click('.branch .dropdown-toggle');
    await environment.click('[data-ta-clickable="refs/heads/branch-3-remove"]');
    await environment.awaitAndClick('.modal-dialog .btn-primary');
    await environment.page.waitForFunction('ungit.__branchDeleteResponed');
  });

  it('add another commit', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/testfile2.txt`, testRepoPaths[0]);
    await environment.commit('commit-3');
    await environment.ensureRefresh();
  });

  it('checkout cherrypick base', async () => {
    await environment.setApiListener('/checkout', 'POST', 'ungit.__checkoutPostResponded');
    await environment.click('.branch .dropdown-toggle');
    await environment.click('[data-ta-clickable="checkoutrefs/heads/branch-1"]');
    await environment.page.waitForFunction('ungit.__checkoutPostResponded');
    await environment.ensureRefresh();
    await environment.waitForElementVisible('[data-ta-name="branch-1"].current');
  });

  it('cherrypick fail case', async () => {
    await environment.wait(1000);
    await environment.clickOnNode('[data-ta-clickable="node-clickable-0"]');
    await environment.awaitAndClick(
      '[data-ta-action="cherry-pick"]:not([style*="display: none"]) .dropmask'
    );
    await environment.click('.staging .btn-stg-abort');
    await environment.awaitAndClick('.modal-dialog .btn-primary');
    await environment.waitForElementVisible('[data-ta-clickable="node-clickable-0"]');
    await environment.ensureRefresh();
  });

  it('cherrypick success case', async () => {
    await environment.setApiListener('/cherrypick', 'POST', 'ungit.__cherrypickPostResponed');
    await environment.clickOnNode('[data-ta-clickable="node-clickable-1"]');
    await environment.click(
      '[data-ta-action="cherry-pick"]:not([style*="display: none"]) .dropmask'
    );
    await environment.page.waitForFunction('ungit.__cherrypickPostResponed');
    await environment.ensureRefresh();
    await environment.waitForElementVisible('[data-ta-node-title="commit-2"] .ref.branch.current');
  });

  it('test backward squash from own lineage', async () => {
    await environment.waitForBranch('branch-1');
    await environment.clickOnNode('.ref.branch.current');
    await environment.click('[data-ta-node-title="commit-1"] .squash .dropmask');
    await environment.waitForElementVisible('.staging .files .file');
    await environment.click('.files button.discard');
    await environment.awaitAndClick('.modal-dialog .btn-primary');
    await environment.ensureRefresh();
    await environment.waitForElementHidden('.staging .files .file');
  });

  it('test forward squash from different lineage', async () => {
    await environment.clickOnNode('.ref.branch.current');
    await environment.click('[data-ta-node-title="commit-3"] .squash .dropmask');
    await environment.ensureRefresh();
    await environment.waitForElementVisible('.staging .files .file');
  });

  it('Auto checkout on branch creation.', async () => {
    await environment.page.evaluate(() => (ungit.config.autoCheckoutOnBranchCreate = true));
    await environment.createBranch('autoCheckout');
    await environment.waitForElementVisible('[data-ta-name="autoCheckout"].current');
  });
});
