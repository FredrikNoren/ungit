
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');

var page = webpage.create();
var suite = testsuite.newSuite('bare', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8451 });
  environment.init(function(err) {
    if (err) return done(err);
    testRepoPath = environment.path + '/testrepo';
    environment.createRepos([
      { bare: true, path: testRepoPath }
      ], done);
  });
});

suite.test('Open path screen', function(done) {
  console.log(1111)
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    console.log(2222)
    helpers.waitForElementVisible(page, '.graph', function() {
      console.log(3333)
      done();
    });
  });
});

suite.test('updateBranches button without branches', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="branch"]', function(err) {
    helpers.click(page, '[data-ta-clickable="branch"]');
    helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"] [data-ta-element="progress-bar"]', function() {
      done();
    });
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
