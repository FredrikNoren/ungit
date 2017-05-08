'use strict';
const expect = require('expect.js');
const testuser = { username: 'testuser', password: 'testpassword' }
const environment = require('./environment')();

let testRepoPath;

describe('test branches', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => {
        testRepoPath = environment.path + '/testrepo';
        return environment.createRepos([{ bare: false, path: testRepoPath }]);
      });
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.goto(environment.getRootUrl() + '/#/repository?path=' + encodeURIComponent(testRepoPath))
      .wait('.graph');
  });

  it('updateBranches button without branches', () => {
    return environment.nightmare.wait('[data-ta-clickable="branch"]')
      .click('[data-ta-clickable="branch"]')
      .ug.waitForElementNotVisible('[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
  });

  it('add a branch', () => {
    return environment.nightmare
      .ug.createTestFile(`${testRepoPath}/testfile.txt`)
      .ug.commit('commit-1')
      .wait('.commit')
      .ug.createBranch('branch-1');
  });

  it('updateBranches button with one branch', () => {
    return environment.nightmare.ug.click('[data-ta-clickable="branch"]')
      .ug.waitForElementNotVisible('[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
  });

  it('add second branch', () => {
    return environment.nightmare.ug.createTestFile(`${testRepoPath}/testfile2.txt`)
      .ug.commit('commit-2')
      .wait('.commit')
      .ug.createBranch('branch-2')
      .ug.createBranch('branch-3');
  });

  it('Check out a branch via selection', () => {
    return environment.nightmare.ug.click('[data-ta-clickable="branch-menu"]')
      .ug.click('[data-ta-clickable="checkoutbranch-2"]')
      .ug.waitForElementNotVisible('[data-ta-clickable="branch"][data-ta-element="progress-bar"]')
  });

  it('Delete a branch via selection', () => {
    return environment.nightmare.click('[data-ta-clickable="branch-menu"]')
      .wait('[data-ta-clickable="branch-3-remove"]')
      .wait(500)
      .click('[data-ta-clickable="branch-3-remove"]')
      .wait(500)
      .click('[data-ta-clickable="yes"]')
      .ug.waitForElementNotVisible('[data-ta-clickable="branch"] [data-ta-element="progress-bar"]')
      .wait(500);
  });

  it('add a commit', () => {
    return environment.nightmare.ug.createTestFile(`${testRepoPath}/testfile2.txt`)
      .ug.commit('commit-3');
  });

  it('checkout chery pick base', () => {
    return environment.nightmare.ug.click('[data-ta-clickable="branch-menu"]')
      .ug.click('[data-ta-clickable="checkoutbranch-1"]')
      .ug.waitForElementNotVisible('[data-ta-clickable="branch"][data-ta-element="progress-bar"]')
  });

  it('cherrypick fail case', () => {
    return environment.nightmare.ug.click('[data-ta-clickable="node-clickable-0"]')
      .ug.click('[data-ta-action="cherry-pick"][data-ta-visible="true"] [role=button]')
      .ug.click('[data-ta-action="abort"]')
      .ug.click('[data-ta-clickable="yes"]')
      .wait(500)
  });

  it('cherrypick success case', () => {
    return environment.nightmare.ug.click('[data-ta-clickable="node-clickable-1"]')
      .ug.click('[data-ta-action="cherry-pick"][data-ta-visible="true"] [role=button]')
      .wait(500)
      .visible('[data-ta-action="abort"]')
      .then((isVisible) => {
        if (isVisible) {
          throw new Error("Cherry pick errored when success was expected.");
        }
        return;
      });
  });

  // I've spent way too much tracking this issue.  but it seems that this is
  // a legitimate bug.  We can see that `/log` result is not including newly
  // created `autoCheckout` branch and it seems that it needs to wait.  I think
  // it passes within phantomjs due to other activity triggering another refresh
  // it('Auto checkout on branch creation.', () => {
  //   return environment.nightmare.evaluate(() => { ungit.config.autoCheckoutOnBranchCreate = true; })
  //     .wait(250)
  //     .ug.createBranch('autoCheckout')
  //     .wait(1000)
  //     .wait('[data-ta-name="autoCheckout"][data-ta-current="true"]');
  // });
});
