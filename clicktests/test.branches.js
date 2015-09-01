
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
    helpers.waitForElement(page, '.graph', function() {
      done();
    });
  });
});

suite.test('updateBranches button without branches', function(done) {
  helpers.waitForElement(page, '[data-ta-clickable="branch"]', function(err) {
    helpers.click(page, '[data-ta-clickable="branch"]');
    helpers.waitForNotElement(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
      done();
    });
  });
});

suite.test('add a branch', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit-1', function() {
      helpers.waitForElement(page, '[data-ta-container="node"]', function() {
        uiInteractions.createBranch(page, 'branch-1', done);
      });
    });
  });
});

suite.test('updateBranches button with one branch', function(done) {
  helpers.waitForElement(page, '[data-ta-clickable="branch"]', function(err) {
    helpers.click(page, '[data-ta-clickable="branch"]');
    helpers.waitForNotElement(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
      done();
    });
  });
});

suite.test('add second branch', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit-2', function() {
      helpers.waitForElement(page, '[data-ta-container="node"]', function() {
        uiInteractions.createBranch(page, 'branch-2', done);
      });
    });
  });
});

suite.test('Check out a branch via selection', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElement(page, '[data-ta-clickable="checkoutbranch-2"]', function() {
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="checkoutbranch-2"]');
      helpers.waitForNotElement(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
        done();
      });
    }, 500);
  });
});

suite.test('Delete a branch via selection', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElement(page, '[data-ta-clickable="branch-1-remove"]', function() {
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="branch-1-remove"]');
      helpers.click(page, '[data-ta-clickable="yes"]');
      helpers.waitForNotElement(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
        setTimeout(done, 500);
      });
    }, 500);
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
