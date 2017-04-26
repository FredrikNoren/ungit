
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('branches', page);

var environment;
var testRepoPath;

suite.test('Init', function() {
  environment = new Environment(page, {});
  return environment.init().then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    });
});

suite.test('Open path screen', function() {
  return uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function() { return helpers.waitForElementVisible(page, '.graph'); });
});

suite.test('updateBranches button without branches', function() {
  return helpers.waitForElementVisible(page, '[data-ta-clickable="branch"]').then(function() {
    helpers.click(page, '[data-ta-clickable="branch"]');
    return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
  });
});

suite.test('add a branch', function() {
  return environment.createTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return uiInteractions.commit(page, 'commit-1'); })
    .then(function() { return helpers.waitForElementVisible(page, '.commit'); })
    .then(function() { return uiInteractions.createBranch(page, 'branch-1'); });
});

suite.test('updateBranches button with one branch', function() {
  return helpers.waitForElementVisible(page, '[data-ta-clickable="branch"]').then(function(err) {
    helpers.click(page, '[data-ta-clickable="branch"]');
    return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]')
  });
});

suite.test('add second branch', function() {
  return environment.createTestFile(testRepoPath + '/testfile2.txt')
    .then(function() { return uiInteractions.commit(page, 'commit-2'); })
    .then(function() { return helpers.waitForElementVisible(page, '.commit'); })
    .then(function() { return uiInteractions.createBranch(page, 'branch-2'); });
});

suite.test('Check out a branch via selection', function() {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  return helpers.waitForElementVisible(page, '[data-ta-clickable="checkoutbranch-2"]')
    .delay(500)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="checkoutbranch-2"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
    });
});

suite.test('Delete a branch via selection', function() {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  return helpers.waitForElementVisible(page, '[data-ta-clickable="branch-2-remove"]')
    .delay(500)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="branch-2-remove"]');
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
    }).delay(500);
});

// CHERRY PICK TESTING

suite.test('add a commit', function() {
  return environment.createTestFile(testRepoPath + '/testfile2.txt')
    .then(function() { return uiInteractions.commit(page, 'commit-3'); });
});

suite.test('checkout chery pick base', function() {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  return helpers.waitForElementVisible(page, '[data-ta-clickable="checkoutbranch-1"]')
    .delay(500)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="checkoutbranch-1"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]')
    })
});

suite.test('cherrypick fail case', function() {
  helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
  return helpers.waitForElementVisible(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]').then(function() {
    helpers.click(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]');
    return helpers.waitForElementVisible(page, '[data-ta-action="abort"]');
  }).then(function() {
    helpers.click(page, '[data-ta-action="abort"]');
    return helpers.waitForElementVisible(page, '[data-ta-clickable="yes"]');
  }).then(function() { helpers.click(page, '[data-ta-clickable="yes"]'); })
  .delay(500)
});

suite.test('cherrypick success case', function() {
  return helpers.waitForElementVisible(page, '[data-ta-clickable="node-clickable-1"]').then(function() {
    helpers.click(page, '[data-ta-clickable="node-clickable-1"]');
    return helpers.waitForElementVisible(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]');
  }).then(function() {
    helpers.click(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]');
  }).delay(500)
  .then(function() {
    if (helpers.elementVisible(page, '[data-ta-action="abort"]')) {
      throw new Error("Cherry pick errored when success was expected.");
    }
  });
});

suite.test('Auto checkout on branch creation.', function() {
  // Set autoCheckoutOnBranchCreate=true on client side instead of restarting
  // ungit with this option as this would be faster.
  page.evaluate(function() {
    ungit.config.autoCheckoutOnBranchCreate = true;
  });

  return uiInteractions.createBranch(page, 'autoCheckout')
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-name="autoCheckout"][data-ta-current="true"]'); });
});

suite.test('Shutdown', function() {
  return environment.shutdown();
});

testsuite.runAllSuits();
