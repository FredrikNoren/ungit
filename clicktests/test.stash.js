
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('discard', page);

var environment;
var testRepoPath;

suite.test('Init', function() {
  environment = new Environment(page, {});
  return environment.init()
    .then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath, initCommits: 1 } ]);
    });
});


suite.test('Open repo screen', function() {
  return uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function () { return helpers.waitForElementVisible(page, '.graph'); })
    .delay(1000);
});

suite.test('Should be possible to stash a file', function() {
  return environment.createTestFile(testRepoPath + '/testfile2.txt')
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]'); })
    .then(function() {
      helpers.click(page, '[data-ta-clickable="stash-all"]');
      if (helpers.elementVisible(page, '[data-ta-clickable="stash-toggle"]')) {
        helpers.click(page, '[data-ta-clickable="stash-toggle"]');
      }
      return helpers.waitForElementVisible(page, '[data-ta-container="stash-stash"]');
    })
});

suite.test('Should be possible to open stash diff', function() {
  helpers.click(page, '[data-ta-clickable="stash-diff"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="stash-diff"]');
});

suite.test('Should be possible to pop a stash', function() {
  helpers.click(page, '[data-ta-clickable="stash-pop"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]');
});

suite.test('Shutdown', function() {
  return environment.shutdown();
});

testsuite.runAllSuits();
