
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
    return environment.goto(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
      .wait('.graph');
  });

  it('updateBranches button without branches', () => {
    return environment.nightmare.wait('[data-ta-clickable="branch"]')
      .click('[data-ta-clickable="branch"]')
      .ug.waitForElementNotVisible('[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
  });

  it('add a branch', () => {
    return environment.nightmare
      .ug.createTestFile(environment.url, testRepoPath + '/testfile.txt')
      .ug.commit('commit-1')
      .wait('.commit')
      .ug.createBranch(environment, 'branch-1');
  });
});



//
// suite.test('updateBranches button with one branch', function(done) {
//   helpers.waitForElementVisible(page, '[data-ta-clickable="branch"]', function(err) {
//     helpers.click(page, '[data-ta-clickable="branch"]');
//     helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
//       done();
//     });
//   });
// });
//
// suite.test('add second branch', function(done) {
//   environment.createTestFile(testRepoPath + '/testfile2.txt', function(err) {
//     if (err) return done(err);
//     uiInteractions.commit(page, 'commit-2', function() {
//       helpers.waitForElementVisible(page, '.commit', function() {
//         uiInteractions.createBranch(page, 'branch-2', done);
//       });
//     });
//   });
// });
//
// suite.test('Check out a branch via selection', function(done) {
//   helpers.click(page, '[data-ta-clickable="branch-menu"]');
//   helpers.waitForElementVisible(page, '[data-ta-clickable="checkoutbranch-2"]', function() {
//     setTimeout(function() {
//       helpers.click(page, '[data-ta-clickable="checkoutbranch-2"]');
//       helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
//         done();
//       });
//     }, 500);
//   });
// });
//
// suite.test('Delete a branch via selection', function(done) {
//   helpers.click(page, '[data-ta-clickable="branch-menu"]');
//   helpers.waitForElementVisible(page, '[data-ta-clickable="branch-2-remove"]', function() {
//     setTimeout(function() {
//       helpers.click(page, '[data-ta-clickable="branch-2-remove"]');
//       helpers.click(page, '[data-ta-clickable="yes"]');
//       helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
//         setTimeout(done, 500);
//       });
//     }, 500);
//   });
// });
//
// // CHERRY PICK TESTING
//
// suite.test('add a commit', function(done) {
//   environment.createTestFile(testRepoPath + '/testfile2.txt', function(err) {
//     if (err) return done(err);
//     uiInteractions.commit(page, 'commit-3', function() {
//       done()
//     });
//   });
// });
//
// suite.test('checkout chery pick base', function(done) {
//   helpers.click(page, '[data-ta-clickable="branch-menu"]');
//   helpers.waitForElementVisible(page, '[data-ta-clickable="checkoutbranch-1"]', function() {
//     setTimeout(function() {
//       helpers.click(page, '[data-ta-clickable="checkoutbranch-1"]');
//       helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
//         done();
//       });
//     }, 500);
//   });
// });
//
// suite.test('cherrypick fail case', function(done) {
//   helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
//   helpers.waitForElementVisible(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]', function() {
//     helpers.click(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]');
//     helpers.waitForElementVisible(page, '[data-ta-action="abort"]', function() {
//       helpers.click(page, '[data-ta-action="abort"]');
//       helpers.waitForElementVisible(page, '[data-ta-clickable="yes"]', function() {
//         helpers.click(page, '[data-ta-clickable="yes"]');
//         setTimeout(done, 500);
//       });
//     });
//   });
// });
//
// suite.test('cherrypick success case', function(done) {
//   helpers.waitForElementVisible(page, '[data-ta-clickable="node-clickable-1"]', function() {
//     helpers.click(page, '[data-ta-clickable="node-clickable-1"]');
//     helpers.waitForElementVisible(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]', function() {
//       helpers.click(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]');
//       setTimeout(function() {
//         if (helpers.elementVisible(page, '[data-ta-action="abort"]')) {
//           done("Cherry pick errored when success was expected.")
//         } else {
//           done();
//         }
//       }, 500);
//     });
//   });
// });
//
// suite.test('Auto checkout on branch creation.', function(done) {
//   // Set autoCheckoutOnBranchCreate=true on client side instead of restarting
//   // ungit with this option as this would be faster.
//   page.evaluate(function() {
//     ungit.config.autoCheckoutOnBranchCreate = true;
//   });
//
//   uiInteractions.createBranch(page, 'autoCheckout', function() {
//     helpers.waitForElementVisible(page, '[data-ta-name="autoCheckout"][data-ta-current="true"]', function() {
//       done();
//     });
//   });
// });
//
// suite.test('Shutdown', function(done) {
//   environment.shutdown(done);
// });
//
// testsuite.runAllSuits();
