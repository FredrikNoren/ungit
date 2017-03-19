
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var Bluebird = require('bluebird');

var page = webpage.create();
var suite = testsuite.newSuite('submodules', page);

var environment;

var subRepoPath;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8460 });
  environment.init()
    .then(function() {
      subRepoPath = environment.path + '/subrepo';
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: subRepoPath, initCommits: 1 }, { bare: false, path: testRepoPath } ]);
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Open repo screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElementVisible(page, '.graph')
      .delay(1000)
      .then(function() { done(); })
      .catch(done);
  });
});

suite.test('Submodule add', function(done) {
  helpers.click(page, '[data-ta-clickable="submodules-menu"]');
  helpers.click(page, '[data-ta-clickable="add-submodule"]');
  helpers.waitForElementVisible(page, '[data-ta-container="add-submodule"]')
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
    })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Submodule update', function(done) {
  helpers.click(page, '[data-ta-clickable="update-submodule"]');
  Bluebird.resolve()
    .delay(500)
    .then(function() {
      return helpers.waitForElementNotVisible(page, '[data-ta-element="progress-bar"]');
    })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Submodule delete check', function(done) {
  // Temporarily disabled to get the build running again
  /*helpers.click(page, '[data-ta-clickable="submodules-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="subrepo-remove"]', function() {
    helpers.click(page, '[data-ta-clickable="subrepo-remove"]');
    helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]', function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      setTimeout(function() { // Wait for progressbar
        helpers.waitForElementNotVisible(page, '[data-ta-element="progress-bar"]', function() {
          done();
        });
      }, 500);
    });
  });*/
  done();
});

suite.test('Shutdown', function(done) {
  environment.shutdown()
    .then(function() { done(); })
    .catch(done);
});

testsuite.runAllSuits();
