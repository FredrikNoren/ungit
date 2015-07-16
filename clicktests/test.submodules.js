
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var fs = require('fs');
var page = webpage.create();
var suite = testsuite.newSuite('submodules', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page);
  environment.init(function(err) {
    if (err) return done(err);
    testRepoPath = environment.path + '/testrepo';
    environment.createRepos([
      { bare: false, path: testRepoPath }
      ], done);
  });
});

suite.test('Open repo screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElement(page, '.graph', function() {
      setTimeout(done, 1000); // Let it finnish loading
    });
  });
});

suite.test('Submodule add', function(done) {
  helpers.click(page, '[data-ta-clickable="submodules-menu"]');
  helpers.click(page, '[data-ta-clickable="add-submodule"]');
  helpers.waitForElement(page, '[data-ta-container="add-submodule"]', function() {
    helpers.click(page, '[data-ta-container="add-submodule"] [data-ta-input="path"]');
    helpers.write(page, 'subrepo');
    helpers.click(page, '[data-ta-container="add-submodule"] [data-ta-input="url"]');
    helpers.write(page, fs.workingDirectory);
    helpers.click(page, '[data-ta-container="add-submodule"] [data-ta-clickable="submit"]');

    setTimeout(function() {
      helpers.waitForElement(page, '[data-ta-container="submodules"] [data-ta-clickable="subrepo"]', function() {
        done();
      });
    }, 3000);
  });
});

suite.test('Submodule view check', function(done) {
  helpers.click(page, '[data-ta-clickable="submodules-menu"]');
  helpers.click(page, '[data-ta-clickable="update-submodule"]');
  helpers.waitForElement(page, '[data-ta-element="progress-bar"]', function() {
    helpers.waitForNotElement(page, '[data-ta-element="progress-bar"]', function() {
      done();
    });
  });
});

suite.test('Submodule delete check', function(done) {
  helpers.click(page, '[data-ta-clickable="submodules-menu"]');
  helpers.waitForElement(page, '[data-ta-clickable="subrepo-remove"]', function() {
    helpers.click(page, '[data-ta-clickable="subrepo-remove"]');
    helpers.waitForElement(page, '[data-ta-container="yes-no-dialog"]', function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      helpers.waitForElement(page, '[data-ta-element="progress-bar"]', function() {
        helpers.waitForNotElement(page, '[data-ta-element="progress-bar"]', function() {
          done();
        });
      });
    });
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
