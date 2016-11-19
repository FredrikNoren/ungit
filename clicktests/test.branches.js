
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
  environment.init(function(err) {
    if (err) return done(err);
    testRepoPath = environment.path + '/testrepo';
    environment.createRepos([
      { bare: false, path: testRepoPath }
      ], done);
  });
});

suite.test('Open path screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElementVisible(page, '.graph', function() {
      done();
    });
  });
});

suite.test('updateBranches button without branches', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="branch"]', function(err) {
    helpers.click(page, '[data-ta-clickable="branch"]');
    helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
      done();
    });
  });
});

suite.test('add a branch', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit-1', function() {
      helpers.waitForElementVisible(page, '.commit', function() {
        uiInteractions.createBranch(page, 'branch-1', done);
      });
    });
  });
});

suite.test('updateBranches button with one branch', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="branch"]', function(err) {
    helpers.click(page, '[data-ta-clickable="branch"]');
    helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
      done();
    });
  });
});

suite.test('add second branch', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit-2', function() {
      helpers.waitForElementVisible(page, '.commit', function() {
        uiInteractions.createBranch(page, 'branch-2', done);
      });
    });
  });
});

suite.test('Check out a branch via selection', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="checkoutbranch-2"]', function() {
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="checkoutbranch-2"]');
      helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
        done();
      });
    }, 500);
  });
});

suite.test('Delete a branch via selection', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="branch-2-remove"]', function() {
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="branch-2-remove"]');
      helpers.click(page, '[data-ta-clickable="yes"]');
      helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
        setTimeout(done, 500);
      });
    }, 500);
  });
});

// CHERRY PICK TESTING

suite.test('add a commit', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit-3', function() {
      done()
    });
  });
});

suite.test('checkout chery pick base', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="checkoutbranch-1"]', function() {
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="checkoutbranch-1"]');
      helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
        done();
      });
    }, 500);
  });
});

suite.test('cherrypick fail case', function(done) {
  helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
  helpers.waitForElementVisible(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]', function() {
    helpers.click(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]');
    helpers.waitForElementVisible(page, '[data-ta-action="abort"]', function() {
      helpers.click(page, '[data-ta-action="abort"]');
      helpers.waitForElementVisible(page, '[data-ta-clickable="yes"]', function() {
        helpers.click(page, '[data-ta-clickable="yes"]');
        setTimeout(done, 500);
      });
    });
  });
});

suite.test('cherrypick success case', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="node-clickable-1"]', function() {
    helpers.click(page, '[data-ta-clickable="node-clickable-1"]');
    helpers.waitForElementVisible(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]', function() {
      helpers.click(page, '[data-ta-action="cherry-pick"][data-ta-visible="true"]');
      setTimeout(function() {
        if (helpers.elementVisible(page, '[data-ta-action="abort"]')) {
          done("Cherry pick errored when success was expected.")
        } else {
          done();
        }
      }, 500);
    });
  });
});

suite.test('Auto checkout on branch creation.', function(done) {
  // Set autoCheckoutOnBranchCreate=true on client side instead of restarting
  // ungit with this option as this would be faster.
  page.evaluate(function() {
    ungit.config.autoCheckoutOnBranchCreate = true;
  });

  uiInteractions.createBranch(page, 'autoCheckout', function() {
    helpers.waitForElementVisible(page, '[data-ta-name="autoCheckout"][data-ta-current="true"]', function() {
      done();
    });
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
