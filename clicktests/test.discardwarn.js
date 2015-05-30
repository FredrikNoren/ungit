
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');

var page = webpage.create();
var suite = testsuite.newSuite('discardwarn', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { serverStartupOptions: ['--disableDiscardWarning'] });
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

suite.test('Should be possible to discard a created file without warning message', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt', function(err) {
    if (err) return done(err);
    helpers.waitForElement(page, '[data-ta-container="staging-file"]', function() {
      helpers.click(page, '[data-ta-clickable="discard-file"]');
			helpers.expectNotFindElement(page, '[data-ta-clickable="yes"]');
      helpers.waitForNotElement(page, '[data-ta-container="staging-file"]', function() {
        done();
      });
    });
  });
});

testsuite.runAllSuits();
