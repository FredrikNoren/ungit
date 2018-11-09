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

  it('add a commit', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.commit('commit-1');
  })

  // < branch search test >
  it('add branches', () => {
    return environment.nm.ug.createBranch("search-1")
      .ug.createBranch("search-2")
      .ug.createBranch("search-3")
      .ug.createBranch("search-4")
      .wait('[data-ta-name="search-4"]')
  });

  it('add tag should make one of the branch disappear', () => {
    return environment.nm.ug.createTag('tag-1')
      .ug.waitForElementNotVisible('[data-ta-name="search-4"]');
  });

  // https://github.com/segmentio/nightmare/issues/932
  it.skip('search for the hidden branch', () => {
    return environment.nm.wait(5000) // sleep to avoid `git-directory-changed` event, which refreshes git nodes and closes search box
      .nm.click('.showSearchForm')
      .wait(200)
      .type('input.name', '-4\u0028\u000d')
      .wait('[data-ta-name="search-4"]')
  });
  // < /branch search test>

  it('updateBranches button without branches', () => {
    return environment.nm.wait('.btn-group.branch .btn-main')
      .click('.btn-group.branch .btn-main')
      .ug.waitForElementNotVisible('#nprogress');
  });

  it('add a branch', () => {
    return environment.nm.ug.createBranch('branch-1');
  });

  it('updateBranches button with one branch', () => {
    return environment.nm.ug.click('.btn-group.branch .btn-main')
      .ug.waitForElementNotVisible('#nprogress');
  });

  it('add second branch', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile2.txt`)
      .wait(500)
      .ug.commit('commit-2')
      .wait('.commit')
      .ug.createBranch('branch-2')
      .ug.createBranch('branch-3');
  });

  it('Check out a branch via selection', () => {
    return environment.nm.ug.click('.branch .dropdown-toggle')
      .ug.click('[data-ta-clickable="checkoutrefs/heads/branch-2"]')
      .ug.waitForElementNotVisible('#nprogress')
  });

  it('Delete a branch via selection', () => {
    return environment.nm.wait(1000)
      .ug.click('.branch .dropdown-toggle')
      .ug.click('[data-ta-clickable="refs/heads/branch-3-remove"]')
      .ug.click('.modal-dialog .btn-primary')
      .ug.waitForElementNotVisible('#nprogress')
      .wait(500);
  });

  it('add a commit', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile2.txt`)
      .ug.commit('commit-3');
  });

  it('checkout cherypick base', () => {
    return environment.nm.ug.click('.branch .dropdown-toggle')
      .ug.click('[data-ta-clickable="checkoutrefs/heads/branch-1"]')
      .ug.waitForElementNotVisible('#nprogress')
  });

  it('cherrypick fail case', () => {
    return environment.nm.ug.click('[data-ta-clickable="node-clickable-0"]')
      .ug.click('[data-ta-action="cherry-pick"]:not([style*="display: none"]) .dropmask')
      .wait(3000) // on windows clicking on cherry pick which results in conflicts might take some time
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

  it('test backward squash from own lineage', () => {
    return environment.nm.ug.click('.ref.branch.current')
      .ug.click('[data-ta-node-title="commit-1"] .squash .dropmask')
      .wait('.staging .files .file')
      .ug.click('.files span.discard')
      .ug.click('.modal-dialog .btn-primary')
      .ug.waitForElementNotVisible('.staging .files .file')
  });

  it('test forward squash from different lineage', () => {
    return environment.nm.ug.click('.ref.branch.current')
      .ug.click('[data-ta-node-title="commit-3"] .squash .dropmask')
      .wait('.staging .files .file')
  });
});
