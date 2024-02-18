'use strict';
const environment = require('./environment')();
const testRepoPaths = [];
const _ = require('lodash');

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
    const branchesResponse = environment.setApiListener('/tags', 'POST');
    await environment.createTag('tag-1');
    await branchesResponse;
    await environment.waitForElementHidden('[data-ta-name="search-4"]');
  });

  it('search for the hidden branch', async () => {
    await environment.awaitAndClick('.showSearchForm');
    await environment.wait(500);
    await environment.type('-4');
    await environment.waitForElementVisible('.branch-search');
    await environment.page.waitForFunction(
      'document.querySelectorAll(".ui-menu-item-wrapper").length > 0 && document.querySelectorAll(".ui-menu-item-wrapper")[0].text.trim() === "search-4"',
      { polling: 250 }
    );
    await environment.press('ArrowDown');
    await environment.press('Enter');

    await environment.waitForElementVisible('[data-ta-name="search-4"]', 10000);
  });

  it('updateBranches button without branches', async () => {
    const branchesResponse = environment.setApiListener('/branches?', 'GET', (body) => {
      return _.isEqual(body, [
        { name: 'master', current: true },
        { name: 'search-1' },
        { name: 'search-2' },
        { name: 'search-3' },
        { name: 'search-4' },
      ]);
    });
    const refsResponse = environment.setApiListener('/refs?', 'GET', (body) => {
      body.forEach((ref) => delete ref.sha1);
      return _.isEqual(body, [
        {
          name: 'refs/heads/master',
        },
        {
          name: 'refs/heads/search-1',
        },
        {
          name: 'refs/heads/search-2',
        },
        {
          name: 'refs/heads/search-3',
        },
        {
          name: 'refs/heads/search-4',
        },
        {
          name: 'refs/tags/tag-1',
        },
      ]);
    });
    await environment.click('.btn-group.branch .btn-main');
    await branchesResponse;
    await refsResponse;
  });

  it('add a branch', () => {
    return environment.createBranch('branch-1');
  });

  it('updateBranches button with one branch', async () => {
    const branchesResponse = environment.setApiListener('/branches?', 'GET', (body) => {
      return _.isEqual(body, [
        { name: 'branch-1' },
        { name: 'master', current: true },
        { name: 'search-1' },
        { name: 'search-2' },
        { name: 'search-3' },
        { name: 'search-4' },
      ]);
    });
    const refsResponse = environment.setApiListener('/refs?', 'GET', (body) => {
      body.forEach((ref) => delete ref.sha1);
      return _.isEqual(body, [
        { name: 'refs/heads/branch-1' },
        {
          name: 'refs/heads/master',
        },
        {
          name: 'refs/heads/search-1',
        },
        {
          name: 'refs/heads/search-2',
        },
        {
          name: 'refs/heads/search-3',
        },
        {
          name: 'refs/heads/search-4',
        },
        {
          name: 'refs/tags/tag-1',
        },
      ]);
    });
    await environment.click('.btn-group.branch .btn-main');
    await branchesResponse;
    await refsResponse;
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
    const branchDeleteResponse = environment.setApiListener('/branches?', 'DELETE');
    await environment.click('.branch .dropdown-toggle');
    await environment.click('[data-ta-clickable="refs/heads/branch-3-remove"]');
    await environment.awaitAndClick('.modal-dialog .btn-primary');
    await branchDeleteResponse;
  });

  it('add another commit', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/testfile2.txt`, testRepoPaths[0]);
    await environment.commit('commit-3');
    await environment.ensureRedraw();
  });

  it('checkout cherrypick base', async () => {
    const checkoutResponse = environment.setApiListener('/checkout', 'POST');
    await environment.click('.branch .dropdown-toggle');
    await environment.click('[data-ta-clickable="checkoutrefs/heads/branch-1"]');
    await checkoutResponse;
    await environment.ensureRedraw();
    await environment.waitForElementVisible('[data-ta-name="branch-1"].current');
  });

  it('cherrypick abort case', async () => {
    await environment.wait(1000);
    await environment.clickOnNode('[data-ta-clickable="node-clickable-0"]');
    await environment.awaitAndClick(
      '[data-ta-action="cherry-pick"]:not([style*="display: none"]) .dropmask'
    );
    await environment.click('.staging .btn-stg-abort');
    await environment.awaitAndClick('.modal-dialog .btn-primary', 2000);
    const gitlogResponse = environment.setApiListener('/gitlog', 'GET', (body) => {
      return _.isEqual(
        body.nodes.map((node) => node.message),
        ['commit-3', 'commit-2', 'commit-1']
      );
    });
    await environment.ensureRedraw();
    await gitlogResponse;
  });

  it('cherrypick success case', async () => {
    const cherrypickPostResponed = environment.setApiListener('/cherrypick', 'POST');
    await environment.clickOnNode('[data-ta-clickable="node-clickable-1"]');
    await environment.click(
      '[data-ta-action="cherry-pick"]:not([style*="display: none"]) .dropmask'
    );
    await cherrypickPostResponed;
    const cherrypickGitlogResponse = environment.setApiListener('/gitlog', 'GET', (body) => {
      return _.isEqual(
        body.nodes.map((node) => node.message),
        ['commit-2', 'commit-3', 'commit-2', 'commit-1']
      );
    });
    await environment.ensureRedraw();
    await cherrypickGitlogResponse;
    await environment.waitForElementVisible('[data-ta-node-title="commit-2"] .ref.branch.current');
  });

  it('test backward squash from own lineage', async () => {
    await environment.wait(1000);
    await environment.waitForBranch('branch-1');
    await environment.clickOnNode('.ref.branch.current');
    await environment.click('[data-ta-node-title="commit-1"] .squash .dropmask');
    await environment.waitForElementVisible('.staging .files .file');
    await environment.click('.files button.discard');
    await environment.awaitAndClick('.modal-dialog .btn-primary', 2000);
    await environment.ensureRedraw();
    await environment.waitForElementHidden('.staging .files .file');
  });

  it('test forward squash from different lineage', async () => {
    await environment.clickOnNode('.ref.branch.current');
    await environment.click('[data-ta-node-title="commit-3"] .squash .dropmask');
    await environment.ensureRedraw();
    await environment.waitForElementVisible('.staging .files .file');
  });

  it('Auto checkout on branch creation.', async () => {
    await environment.page.evaluate(() => (ungit.config.autoCheckoutOnBranchCreate = true));
    await environment.createBranch('autoCheckout');
    await environment.waitForElementVisible('[data-ta-name="autoCheckout"].current');
  });
});
