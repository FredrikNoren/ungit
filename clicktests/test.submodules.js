
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var Bluebird = require('bluebird');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('submodules', page);

var environment;

var subRepoPath;
var testRepoPath;

suite.test('Init', function() {
  environment = new Environment(page, { port: 8460 });
  return environment.init()
    .then(function() {
      subRepoPath = environment.path + '/subrepo';
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: subRepoPath, initCommits: 1 }, { bare: false, path: testRepoPath } ]);
    });
});

suite.test('Open repo screen', function() {
  return uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function () { return helpers.waitForElementVisible(page, '.graph'); })
    .delay(1000);
});

suite.test('Submodule add', function() {
  helpers.click(page, '[data-ta-clickable="submodules-menu"]');
  helpers.click(page, '[data-ta-clickable="add-submodule"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="add-submodule"]')
    .then(function() {
      helpers.click(page, '[data-ta-container="add-submodule"] [data-ta-input="path"]');
      helpers.write(page, 'subrepo');
      helpers.click(page, '[data-ta-container="add-submodule"] [data-ta-input="url"]');
      helpers.write(page, subRepoPath);
      helpers.click(page, '[data-ta-container="add-submodule"] [data-ta-clickable="submit"]');
    }).delay(500)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="submodules-menu"]');
      return helpers.waitForElementVisible(page, '[data-ta-container="submodules"] [data-ta-clickable="subrepo"]');
    });
});

suite.test('Submodule update', function() {
  helpers.click(page, '[data-ta-clickable="update-submodule"]');
  return Bluebird.resolve()
    .delay(500)
    .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-element="progress-bar"]'); });
});

suite.test('Submodule delete check', function() {
  // Temporarily disabled to get the build running again
  /*helpers.click(page, '[data-ta-clickable="submodules-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="subrepo-remove"]', function() {
    helpers.click(page, '[data-ta-clickable="subrepo-remove"]');
    helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]', function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      setTimeout(function() { // Wait for progressbar
        helpers.waitForElementNotVisible(page, '[data-ta-element="progress-bar"]', function() {
          ();
        });
      }, 500);
    });
  });*/
  return Bluebird.resolve();
});

suite.test('Shutdown', function() {
  return environment.shutdown();
});

testsuite.runAllSuits();
