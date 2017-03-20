
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('noheader', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8456 });
  environment.init()
    .then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    }).then(function() { done(); })
    .catch(done);
});


suite.test('Open path screen', function(done) {
  uiInteractions.open(page, '')
    .then(function() { return uiInteractions.open(page, environment.url + '/?noheader=true#/repository?path=' + encodeURIComponent(testRepoPath)); })
    .then(function () { return helpers.waitForElementVisible(page, '[data-ta-container="repository-view"]'); })
    .then(function() {
      if (helpers.elementVisible(page, '[data-ta-container="remote-error-popup"]')) {
        throw new Error('Should not find remote error popup');
      }
    }).then(function() { done(); })
    .catch(done);
});


suite.test('Check for refresh button', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="refresh-button"]')
    .then(function() { helpers.click(page, '[data-ta-clickable="refresh-button"]'); })
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
