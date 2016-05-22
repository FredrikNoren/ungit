
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');

var page = webpage.create();
var suite = testsuite.newSuite('noheader', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8456 });
  environment.init(function(err) {
    if (err) return done(err);
    testRepoPath = environment.path + '/testrepo';
    environment.createRepos([
      { bare: false, path: testRepoPath }
      ], done);
  });
});


suite.test('Open path screen', function(done) {
  page.open('', function() { // Reset path, otherwise the next open don't do anything as it's the same uri
    page.open(environment.url + '/?noheader=true#/repository?path=' + encodeURIComponent(testRepoPath), function () {
      helpers.waitForElementVisible(page, '[data-ta-container="repository-view"]', function() {
        if (helpers.elementVisible(page, '[data-ta-container="remote-error-popup"]'))
          return done(new Error('Should not find remote error popup'));
        done();
      });
    });
  });
});


suite.test('Check for refresh button', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="refresh-button"]', function(err) {
    helpers.click(page, '[data-ta-clickable="refresh-button"]');
    setTimeout(function() {
      done();
    }, 500);
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
