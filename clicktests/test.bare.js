
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('bare', page);

var environment;
var testRepoPath;

suite.test('Init', function() {
  environment = new Environment(page, { port: 8451 });
  return environment.init()
    .then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: true, path: testRepoPath } ]);
    });
});

suite.test('Open path screen', function() {
  return uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function() { return helpers.waitForElementVisible(page, '.graph'); });
});

suite.test('updateBranches button without branches', function() {
  return helpers.waitForElementVisible(page, '[data-ta-clickable="branch"]')
    .then(function(err) {
      helpers.click(page, '[data-ta-clickable="branch"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]')
    });
});

suite.test('Shutdown', function() {
  return environment.shutdown();
});

testsuite.runAllSuits();
