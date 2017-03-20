
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('screens', page);

var environment;

suite.test('Init', function() {
  environment = new Environment(page, { port: 8459, showServerOutput: true });
  return environment.init();
});

suite.test('Open home screen', function() {
  return uiInteractions.open(page, environment.url)
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="home-page"]'); });
});

var testRepoPath;

suite.test('Create test directory', function() {
  testRepoPath = environment.path + '/testrepo';
  return environment.createFolder(testRepoPath);
});

suite.test('Open path screen', function() {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath));
  return helpers.waitForElementVisible(page, '[data-ta-container="uninited-path-page"]');
});

suite.test('Init repository should bring you to repo page', function() {
  helpers.click(page, '[data-ta-clickable="init-repository"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="repository-view"]')
    .then(function() {
      if (helpers.elementVisible(page, '[data-ta-container="remote-error-popup"]')) {
        throw new Error('Should not find remote error popup');
      }
    });
});

suite.test('Clicking logo should bring you to home screen', function() {
  helpers.click(page, '[data-ta-clickable="home-link"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="home-page"]');
});

suite.test('Entering an invalid path and create directory in that location', function() {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.write(page, environment.path + '/not/existing\n');
  return helpers.waitForElementVisible(page, '[data-ta-container="invalid-path"]')
    .then(function() {
      helpers.click(page, '[data-ta-clickable="create-dir"]');
      return helpers.waitForElementVisible(page, '[data-ta-clickable="init-repository"]');
    });
});

suite.test('Entering an invalid path should bring you to an error screen', function() {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.write(page, '/a/path/that/doesnt/exist\n');
  return helpers.waitForElementVisible(page, '[data-ta-container="invalid-path"]');
});

suite.test('Entering a path to a repo should bring you to that repo', function() {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.selectAllText(page);
  helpers.write(page, testRepoPath + '\n');
  return helpers.waitForElementVisible(page, '[data-ta-container="repository-view"]');
});

suite.test('Create test directory with ampersand and open it', function() {
  var specialRepoPath = environment.path + '/test & repo';
  var tempPage = webpage.create();
  return environment.createFolder(specialRepoPath)
    .then(function() { return uiInteractions.open(tempPage, environment.url + '/#/repository?path=' + encodeURIComponent(specialRepoPath)); })
    .then(function() { return helpers.waitForElementVisible(tempPage, '[data-ta-container="uninited-path-page"]'); });
});

suite.test('Shutdown', function() {
  return environment.shutdown()
});

testsuite.runAllSuits();
