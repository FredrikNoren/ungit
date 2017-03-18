
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');

var page = webpage.create();
var suite = testsuite.newSuite('screens', page);

var environment;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8459, showServerOutput: true });
  environment.init()
    .then(function() { done(); })
    .catch(done);
});

suite.test('Open home screen', function(done) {
  page.open(environment.url, function() {
    helpers.waitForElementVisible(page, '[data-ta-container="home-page"]')
      .then(function() { done(); })
      .catch(done);
  });
});

var testRepoPath;

suite.test('Create test directory', function(done) {
  testRepoPath = environment.path + '/testrepo';
  environment.createFolder(testRepoPath)
    .then(function() { done(); })
    .catch(done);
});

suite.test('Open path screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath));
  helpers.waitForElementVisible(page, '[data-ta-container="uninited-path-page"]')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Init repository should bring you to repo page', function(done) {
  helpers.click(page, '[data-ta-clickable="init-repository"]');
  helpers.waitForElementVisible(page, '[data-ta-container="repository-view"]')
    .then(function() {
      if (helpers.elementVisible(page, '[data-ta-container="remote-error-popup"]')) {
        throw new Error('Should not find remote error popup');
      }
    })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Clicking logo should bring you to home screen', function(done) {
  helpers.click(page, '[data-ta-clickable="home-link"]');
  helpers.waitForElementVisible(page, '[data-ta-container="home-page"]')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Entering an invalid path and create directory in that location', function(done) {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.write(page, environment.path + '/not/existing\n');
  helpers.waitForElementVisible(page, '[data-ta-container="invalid-path"]')
    .then(function() {
      helpers.click(page, '[data-ta-clickable="create-dir"]');
      return helpers.waitForElementVisible(page, '[data-ta-clickable="init-repository"]')
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Entering an invalid path should bring you to an error screen', function(done) {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.write(page, '/a/path/that/doesnt/exist\n');
  helpers.waitForElementVisible(page, '[data-ta-container="invalid-path"]')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Entering a path to a repo should bring you to that repo', function(done) {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.selectAllText(page);
  helpers.write(page, testRepoPath + '\n');
  helpers.waitForElementVisible(page, '[data-ta-container="repository-view"]')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Create test directory with ampersand and open it', function(done) {
  var specialRepoPath = environment.path + '/test & repo';
  environment.createFolder(specialRepoPath)
    .then(function() {
      page.open('', function() {
        page.open(environment.url + '/#/repository?path=' + encodeURIComponent(specialRepoPath));
        helpers.waitForElementVisible(page, '[data-ta-container="uninited-path-page"]')
          .then(function() { done(); })
          .catch(done);
      });
    });
});

suite.test('Shutdown', function(done) {
  environment.shutdown()
    .then(function() { done(); })
    .catch(done);
});

testsuite.runAllSuits();
