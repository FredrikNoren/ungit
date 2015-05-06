
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');

var page = webpage.create();
var suite = testsuite.newSuite('plugins', page);

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

suite.test('Open path screen', function(done) {
  page.open('', function() { // Reset path, otherwise the next open don't do anything as it's the same uri
    page.open(environment.url + '/?noheader=true#/repository?path=' + encodeURIComponent(testRepoPath), function () {
      helpers.waitForElement(page, '[data-ta-container="repository-view"]', function() {
        helpers.expectNotFindElement(page, '[data-ta-container="remote-error-popup"]');
        done();
      });
    });
  });
});

suite.test('Check for updateBranches button without branch', function(done) {
  helpers.waitForElement(page, '[data-ta-clickable="updateBranches"]', function(err) {
    helpers.click(page, '[data-ta-clickable="updateBranches"]');
    setTimeout(function() {
      done();
    }, 500);
  });
});

suite.test('Setup test env for branches', function(done) {
	done();
});

suite.test('Check for updateBranches button with two branches', function(done) {

	done();
});

suite.test('Check out a branch via selection', function(done) {
	done();
});


testsuite.runAllSuits();
