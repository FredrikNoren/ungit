
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');
var Bluebird = require('bluebird')

var page = webpage.create();
var suite = testsuite.newSuite('loadAhead', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8462, serverStartupOptions: ['--numberOfNodesPerLoad=1'] });
  environment.init().then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Open path screen', function(done) {
  uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function () { return helpers.waitForElementVisible(page, '.graph'); })
    .delay(500)
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to create and commit 1', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return uiInteractions.commit(page, 'commit 1'); })
    .then(function() { return helpers.waitForElementVisible(page, '.commit'); })
    .then(function() { return uiInteractions.createBranch(page, 'branch-1', done); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to create and commit 2', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return uiInteractions.commit(page, 'commit 2'); })
    .then(function() { return helpers.waitForElementVisible(page, '.commit'); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to create and commit 3', function(done) {
  helpers.click(page, '[data-ta-clickable="branch-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="checkoutbranch-1"]')
    .delay(500)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="checkoutbranch-1"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
    })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Open path screen again and should see only 1 commit', function(done) {
  uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="nodes-skipped"]'); })
    .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-clickable="node-clickable-1"]') })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Create a branch during collapsed mode', function(done) {
  Bluebird.resolve().delay(500)
    .then(function() { return uiInteractions.createBranch(page, 'new-branch'); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Load ahead', function(done) {
  helpers.click(page, '[data-ta-container="nodes-skipped"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="node-clickable-1"]')
    .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-container="nodes-skipped"]'); })
    .delay(500)
    .then(function() { done(); })
    .catch(done);
});

suite.test('Shutdown', function(done) {
  environment.shutdown()
    .then(function() { done(); })
    .catch(done);
});

testsuite.runAllSuits();
