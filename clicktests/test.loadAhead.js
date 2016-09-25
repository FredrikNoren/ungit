
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('loadAhead', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8462, serverStartupOptions: ['--numberOfNodesPerLoad=1'] });
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
      setTimeout(done, 500);
    });
  });
});

suite.test('Should be possible to create and commit 1', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit 1', function() {
      helpers.waitForElementVisible(page, '.commit', function() {
        uiInteractions.createBranch(page, 'branch-1', done);
      });
    });
  });
});

suite.test('Should be possible to create and commit 2', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit 2', function() {
      helpers.waitForElementVisible(page, '.commit', function() {
        done();
      });
    });
  });
});

suite.test('Should be possible to create and commit 3', function(done) {
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

suite.test('Open path screen again and should see only 1 commit', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElementVisible(page, '[data-ta-container="nodes-skipped"]', function() {
      helpers.waitForElementNotVisible(page, '[data-ta-clickable="node-clickable-1"]', function() {
        done();
      });
    });
  });
});

suite.test('Create a branch during collapsed mode', function(done) {
  setTimeout(function() {
    uiInteractions.createBranch(page, 'new-branch', done);
  }, 500);
});

suite.test('Load ahead', function(done) {
  helpers.click(page, '[data-ta-container="nodes-skipped"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="node-clickable-1"]', function() {
    helpers.waitForElementNotVisible(page, '[data-ta-container="nodes-skipped"]', function() {
      setTimeout(done, 500);
    });
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
