
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
  page.open('', function() { // Reset path, otherwise the next open don't do anything as it's the same uri
    page.open(environment.url + '/?noheader=true#/repository?path=' + encodeURIComponent(testRepoPath), function () {
      helpers.waitForElement(page, '[data-ta-container="repository-view"]', function() {
        helpers.expectNotFindElement(page, '[data-ta-container="remote-error-popup"]');
        done();
      });
    });
  });
});

suite.test('Check for updateBranches button without branch', function(done) {
  helpers.waitForElement(page, '[data-ta-clickable="branch"]', function(err) {
    helpers.click(page, '[data-ta-clickable="branch"]');
    setTimeout(function() {
      done();
    }, 500);
  });
});

suite.test('add a for branch', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit-1', function() {
      helpers.waitForElement(page, '[data-ta-container="node"]', function() {
        uiInteractions.createBranch(page, 'branch-1', done);
        done();
      });
    });
  });
});

suite.test('Check for updateBranches button with one branch', function(done) {
  helpers.waitForElement(page, '[data-ta-clickable="branch"]', function(err) {
    helpers.click(page, '[data-ta-clickable="branch"]');
    setTimeout(function() {
      done();
    }, 500);
  });
});

suite.test('add second branch', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit-2', function() {
      helpers.waitForElement(page, '[data-ta-container="node"]', function() {
        uiInteractions.createBranch(page, 'branch-2', done);
        done();
      });
    });
  });
});

suite.test('Check out a branch via selection', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElement(page, '[data-ta-clickable="branch"] [data-ta-element="branch-menu"]', function() {
    helpers.waitForNotElement(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
      done();
    });
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
