
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('bare', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8451 });
  environment.init()
    .then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: true, path: testRepoPath } ]);
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Open path screen', function(done) {
  uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function() { return helpers.waitForElementVisible(page, '.graph'); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('updateBranches button without branches', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="branch"]')
    .then(function(err) {
      helpers.click(page, '[data-ta-clickable="branch"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]')
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Shutdown', function(done) {
  environment.shutdown()
    .then(function() { done(); })
    .catch(done);
});

testsuite.runAllSuits();
