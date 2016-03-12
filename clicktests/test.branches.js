
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
  environment = new Environment(page);
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
  helpers.waitForElementVisible(page, '[data-ta-clickable="branch-1-remove"]', function() {
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="branch-1-remove"]');
      helpers.click(page, '[data-ta-clickable="yes"]');
      helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
        setTimeout(done, 500);
      });
    }, 500);
  });
});

// CHERRY PICK TESTING

suite.test('Create cherrypick test file and add third branch', function(done) {
  environment.createTestFile(testRepoPath + '/cherry.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit-3', function() {
      helpers.waitForElementVisible(page, '.commit', function() {
        uiInteractions.createBranch(page, 'branch-3', done);
      });
    });
  });
});

suite.test('Roll back to ~1 commit by checking out a branch', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="checkoutmaster"]', function() {
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="checkoutmaster"]');
      helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
        done();
      });
    }, 500);
  });
});

suite.test('Cherrypick success test', function(done) {
  helpers.click(page, '[data-ta-clickable="node-clickable-0"]')
  helpers.waitForElementVisible(page, '[data-ta-action="cherry-pick"]', function() {
    helpers.click(page, '[data-ta-action="cherry-pick"]');
    setTimeout(function() {
      if (helpers.elementVisible(page, '[data-ta-container="user-error-page"]') || helpers.elementVisible(page, '[data-ta-container="staging-file"]')) {
        done("Cherry-pick error!");
      }else {
        done();
      }
    }, 500);
  });
});

suite.test('Cherrypick self (causes error and creates ./git/CHERRY_PICK_HEAD but no conflicts)', function(done) {
  helpers.click(page, '[data-ta-clickable="node-clickable-0"]')
  helpers.waitForElementVisible(page, '[data-ta-action="cherry-pick"]', function() {
    helpers.click(page, '[data-ta-action="cherry-pick"]');
    helpers.waitForElementVisible(page, '[data-ta-container="git-error-container"]', function() {
      if (helpers.elementVisible(page, '[data-ta-clickable="graph"]')) {
        done();
      } else {
        done("Cheerypick self should cause error but should not get into merge state.")
      }
    });
  });
});


suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
