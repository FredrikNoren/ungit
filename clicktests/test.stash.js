
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('discard', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8461 });
  environment.init()
    .then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath, initCommits: 1 } ]);
    }).then(function() { done(); })
    .catch(done);
});


suite.test('Open repo screen', function(done) {
  uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function () { return helpers.waitForElementVisible(page, '.graph'); })
    .delay(1000)
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to stash a file', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt')
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]'); })
    .then(function() {
      helpers.click(page, '[data-ta-clickable="stash-all"]');
      if (helpers.elementVisible(page, '[data-ta-clickable="stash-toggle"]')) {
        helpers.click(page, '[data-ta-clickable="stash-toggle"]');
      }
      return helpers.waitForElementVisible(page, '[data-ta-container="stash-stash"]');
    })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to open stash diff', function(done) {
  helpers.click(page, '[data-ta-clickable="stash-diff"]');
  helpers.waitForElementVisible(page, '[data-ta-container="stash-diff"]')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to pop a stash', function(done) {
  helpers.click(page, '[data-ta-clickable="stash-pop"]');
  helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Shutdown', function(done) {
  environment.shutdown()
    .then(function() { done(); })
    .catch(done);
});

testsuite.runAllSuits();
