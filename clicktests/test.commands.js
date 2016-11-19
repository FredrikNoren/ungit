
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('commands', page);

var environment;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8463 });
  environment.init(function(err) {
    if (err) return done(err);
    testRepoPath = environment.path + '/testrepo';
    environment.createRepos([
      { bare: false, path: testRepoPath }
      ], done);
  });
});

suite.test('Open path screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElementVisible(page, '.graph', function() {
      done();
    });
  });
});

suite.test('add a branch-1', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit-1', function() {
      helpers.waitForElementVisible(page, '.commit', function() {
        uiInteractions.createBranch(page, 'branch-1', done);
      });
    });
  });
});

suite.test('add a branch-2', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'commit-1', function() {
      helpers.waitForElementVisible(page, '.commit', function() {
        uiInteractions.createBranch(page, 'branch-2', done);
      });
    });
  });
});

var branchTagLoc;
suite.test('test branch create from command line', function(done) {
  environment.gitCommand({ command: ["branch", "gitCommandBranch"], repo: testRepoPath }, function() {
    helpers.waitForElementVisible(page, '[data-ta-name="gitCommandBranch"]', function() {
      branchTagLoc = helpers.getClickPosition(page, '[data-ta-name="gitCommandBranch"]');
      done();
    });
  });
});

suite.test('test branch move from command line', function(done) {
  environment.gitCommand({ command: ["branch", "-f", "gitCommandBranch", "branch-2"], repo: testRepoPath }, function() {
    setTimeout(function() {
      if (branchTagLoc == helpers.getClickPosition(page, '[data-ta-name="gitCommandBranch"]')) {
        done("Branch haven't moved");
      } else {
        done();
      }
    }, 500);
  });
});

suite.test('test branch delete from command line', function(done) {
  environment.gitCommand({ command: ["branch", "-D", "gitCommandBranch"], repo: testRepoPath }, function() {
    helpers.waitForElementNotVisible(page, '[data-ta-name="gitCommandBranch"]', function() {
      done();
    });
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
