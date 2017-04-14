
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');

var page = webpage.create();
var suite = testsuite.newSuite('stash', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8461 });
  environment.init(function(err) {
    if (err) return done(err);
    testRepoPath = environment.path + '/testrepo';
    environment.createRepos([
      { bare: false, path: testRepoPath, initCommits: 1 }
      ], done);
  });
});


suite.test('Open repo screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElementVisible(page, '.graph', function() {
      setTimeout(done, 1000); // Let it finnish loading
    });
  });
});

suite.test('Should be possible to stash a file', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt', function(err) {
    if (err) return done(err);
    helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]', function() {
      helpers.click(page, '[data-ta-clickable="stash-all"]');

      // if stash is currently collapsed show it. (localStorage['showStash'] might already be 'true')
      if (helpers.elementVisible(page, '[data-ta-clickable="stash-toggle"]')) {
        helpers.click(page, '[data-ta-clickable="stash-toggle"]');
      }

      helpers.waitForElementVisible(page, '[data-ta-container="stash-stash"]', function() {
        done();
      });
    });
  });
});

suite.test('Should be possible to open stash diff', function(done) {
  helpers.click(page, '[data-ta-clickable="stash-diff"]');
  helpers.waitForElementVisible(page, '[data-ta-container="stash-diff"]', function() {
    done();
  });
});

suite.test('Should be possible to pop a stash', function(done) {
  helpers.click(page, '[data-ta-clickable="stash-pop"]');
  helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]', function() {
    done();
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
