'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

describe('[BRANCHES]', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false }]));
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[0])
  });

  it('updateBranches button without branches', () => {
    return environment.nm.wait('.btn-group.branch .btn-main')
      .click('.btn-group.branch .btn-main')
      .ug.waitForElementNotVisible('.btn-group.branch .btn-main .progress');
  });

  it('add a branch', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.commit('commit-1')
      .wait('.commit')
      .ug.createBranch('branch-1');
  });

  it('updateBranches button with one branch', () => {
    return environment.nm.ug.click('.btn-group.branch .btn-main')
      .ug.waitForElementNotVisible('.btn-group.branch .btn-main .progress');
  });

  it('add second branch', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile2.txt`)
      .ug.commit('commit-2')
      .wait('.commit')
      .ug.createBranch('branch-2')
      .ug.createBranch('branch-3');
  });

  it('Check out a branch via selection', () => {
    return environment.nm.ug.click('.branch .dropdown-toggle')
      .ug.click('[data-ta-clickable="checkoutbranch-2"]')
      .ug.waitForElementNotVisible('.btn-group.branch .btn-main .progress')
  });

  it('Delete a branch via selection', () => {
    return environment.nm.click('.branch .dropdown-toggle')
      .wait('[data-ta-clickable="branch-3-remove"]')
      .wait(500)
      .click('[data-ta-clickable="branch-3-remove"]')
      .wait(500)
      .click('.modal-dialog .btn-primary')
      .ug.waitForElementNotVisible('.btn-group.branch .btn-main .progress')
      .wait(500);
  });

  it('add a commit', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile2.txt`)
      .ug.commit('commit-3');
  });

  it('checkout cherypick base', () => {
    return environment.nm.ug.click('.branch .dropdown-toggle')
      .ug.click('[data-ta-clickable="checkoutbranch-1"]')
      .ug.waitForElementNotVisible('.btn-group.branch .btn-main .progress')
  });

  it('cherrypick fail case', () => {
    return environment.nm.ug.click('[data-ta-clickable="node-clickable-0"]')
      .ug.click('[data-ta-action="cherry-pick"]:not([style*="display: none"]) .dropmask')
      .ug.click('.staging .btn-stg-abort')
      .ug.click('.modal-dialog .btn-primary')
      .wait(500)
  });

  it('cherrypick success case', () => {
    return environment.nm.ug.click('[data-ta-clickable="node-clickable-1"]')
      .ug.click('[data-ta-action="cherry-pick"]:not([style*="display: none"]) .dropmask')
      .wait(500)
      .visible('.staging .btn-stg-abort')
      .then((isVisible) => {
        if (isVisible) {
          throw new Error("Cherry pick errored when success was expected.");
        }
      });
  });

  // I've spent way too much tracking this issue.  but it seems that this is
  // a legitimate bug.  We can see that `/log` result is not including newly
  // created `autoCheckout` branch and it seems that it needs to wait.  I think
  // it passes within phantomjs due to other activity triggering another refresh
  it('Auto checkout on branch creation.', () => {
    return environment.nm.evaluate(() => { ungit.config.autoCheckoutOnBranchCreate = true; })
      .wait(250)
      .ug.createBranch('autoCheckout')
      .wait(1000)
      .wait('[data-ta-name="autoCheckout"].current');
  });
});
