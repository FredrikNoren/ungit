
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('noheader', page);

var environment;
var testRepoPath;

suite.test('Init', function() {
  environment = new Environment(page, { port: 8456 });
  return environment.init()
    .then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    });
});


suite.test('Open path screen', function() {
  return uiInteractions.open(page, '')
    .then(function() { return uiInteractions.open(page, environment.url + '/?noheader=true#/repository?path=' + encodeURIComponent(testRepoPath)); })
    .then(function () { return helpers.waitForElementVisible(page, '[data-ta-container="repository-view"]'); })
    .then(function() {
      if (helpers.elementVisible(page, '[data-ta-container="remote-error-popup"]')) {
        throw new Error('Should not find remote error popup');
      }
    });
});


suite.test('Check for refresh button', function() {
  return helpers.waitForElementVisible(page, '[data-ta-clickable="refresh-button"]')
    .then(function() { helpers.click(page, '[data-ta-clickable="refresh-button"]'); })
    .delay(500);
});

suite.test('Shutdown', function() {
  return environment.shutdown();
});

testsuite.runAllSuits();
