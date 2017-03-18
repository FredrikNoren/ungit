
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('branches', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8452 });
  environment.init().then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Open path screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElementVisible(page, '.graph')
      .then(function() { done(); })
      .catch(done);
  });
});

suite.test('updateBranches button without branches', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="branch"]').then(function() {
    helpers.click(page, '[data-ta-clickable="branch"]');
    return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('add a branch', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt').then(function() {
    return uiInteractions.commit(page, 'commit-1');
  }).then(function() {
    helpers.waitForElementVisible(page, '.commit')
  }).then(function() {
    uiInteractions.createBranch(page, 'branch-1');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('updateBranches button with one branch', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="branch"]').then(function(err) {
    helpers.click(page, '[data-ta-clickable="branch"]');
    return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]')
  }).then(function() { done(); })
  .catch(done);
});

suite.test('add second branch', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt').then(function() {
    return uiInteractions.commit(page, 'commit-2');
  }).then(function() {
    return helpers.waitForElementVisible(page, '.commit');
  }).then(function() {
    return uiInteractions.createBranch(page, 'branch-2');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('Check out a branch via selection', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="checkoutbranch-2"]')
  .delay(500)
  .then(function() {
    helpers.click(page, '[data-ta-clickable="checkoutbranch-2"]');
    return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('Delete a branch via selection', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="branch-2-remove"]')
  .delay(500)
  .then(function() {
    helpers.click(page, '[data-ta-clickable="branch-2-remove"]');
    helpers.click(page, '[data-ta-clickable="yes"]');
    return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
  }).delay(500)
  .then(function() { done(); })
  .catch(done);
});

// CHERRY PICK TESTING

suite.test('add a commit', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt').then(function() {
    return uiInteractions.commit(page, 'commit-3');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('checkout chery pick base', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="checkoutbranch-1"]')
  .delay(500)
  .then(function() {
    helpers.click(page, '[data-ta-clickable="checkoutbranch-1"]');
    return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]')
  }).then(function() { done(); })
  .catch(done);
});

suite.test('cherrypick fail case', function(done) {
  helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
  helpers.waitForElementVisible(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]').then(function() {
    helpers.click(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]');
    return helpers.waitForElementVisible(page, '[data-ta-action="abort"]');
  }).then(function() {
    helpers.click(page, '[data-ta-action="abort"]');
    return helpers.waitForElementVisible(page, '[data-ta-clickable="yes"]');
  }).then(function() {
    helpers.click(page, '[data-ta-clickable="yes"]');
  }).delay(500)
  .then(function() { done(); })
  .catch(done);
});

suite.test('cherrypick success case', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="node-clickable-1"]').then(function() {
    helpers.click(page, '[data-ta-clickable="node-clickable-1"]');
    return helpers.waitForElementVisible(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]');
  }).then(function() {
    helpers.click(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]');
  }).delay(500)
  .then(function() {
    if (helpers.elementVisible(page, '[data-ta-action="abort"]')) {
      throw new Error("Cherry pick errored when success was expected.");
    }
  }).then(function() { done(); })
  .catch(done);
});

suite.test('Auto checkout on branch creation.', function(done) {
  // Set autoCheckoutOnBranchCreate=true on client side instead of restarting
  // ungit with this option as this would be faster.
  page.evaluate(function() {
    ungit.config.autoCheckoutOnBranchCreate = true;
  });

  uiInteractions.createBranch(page, 'autoCheckout').then(function() {
    return helpers.waitForElementVisible(page, '[data-ta-name="autoCheckout"][data-ta-current="true"]');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('Shutdown', function(done) {
  environment.shutdown()
    .then(function() { done(); })
    .catch(done);
});

testsuite.runAllSuits();
