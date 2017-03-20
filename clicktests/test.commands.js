
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
  environment.init().then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Open path screen', function(done) {
  uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function() { return helpers.waitForElementVisible(page, '.graph'); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('add a branch-1', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt').then(function() {
    return uiInteractions.commit(page, 'commit-1');
  }).then(function() {
    return helpers.waitForElementVisible(page, '.commit');
  }).then(function() {
    return uiInteractions.createBranch(page, 'branch-1');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('add a branch-2', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt').then(function() {
    return uiInteractions.commit(page, 'commit-1');
  }).then(function() {
    return helpers.waitForElementVisible(page, '.commit');
  }).then(function() {
    return uiInteractions.createBranch(page, 'branch-2');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('test branch create from command line', function(done) {
  environment.gitCommand({ command: ["branch", "gitCommandBranch"], repo: testRepoPath }).then(function() {
    return helpers.waitForElementVisible(page, '[data-ta-name="gitCommandBranch"]')
  }).then(function() { done(); })
  .catch(done)
});

suite.test('test branch move from command line', function(done) {
  var branchTagLoc = JSON.stringify(helpers.getClickPosition(page, '[data-ta-name="gitCommandBranch"]'));
  environment.gitCommand({ command: ["branch", "-f", "gitCommandBranch", "branch-1"], repo: testRepoPath })
  .delay(1000)
  .then(function() {
    console.log(branchTagLoc, JSON.stringify(helpers.getClickPosition(page, '[data-ta-name="gitCommandBranch"]')))
    if (branchTagLoc == JSON.stringify(helpers.getClickPosition(page, '[data-ta-name="gitCommandBranch"]'))) {
      done("Branch haven't moved");
    } else {
      done();
    }
  });
});

suite.test('test branch delete from command line', function(done) {
  environment.gitCommand({ command: ["branch", "-D", "gitCommandBranch"], repo: testRepoPath }).then(function() {
    return helpers.waitForElementNotVisible(page, '[data-ta-name="gitCommandBranch"]');
  }).then(function() { done(); })
  .catch(done)
});

suite.test('test tag create from command line', function(done) {
  environment.gitCommand({ command: ["tag", "tag1"], repo: testRepoPath }).then(function() {
    return helpers.waitForElementVisible(page, '[data-ta-name="tag1"]')
  }).then(function() { done(); })
  .catch(done)
});

suite.test('test tag delete from command line', function(done) {
  environment.gitCommand({ command: ["tag", "-d", "tag1"], repo: testRepoPath }).then(function() {
    return helpers.waitForElementNotVisible(page, '[data-ta-name="tag1"]')
  }).then(function() { done(); })
  .catch(done)
});

suite.test('test reset from command line', function(done) {
  var headLoc = JSON.stringify(helpers.getClickPosition(page, '[data-ta-current="true"]'));
  environment.gitCommand({ command: ["reset", "branch-1"], repo: testRepoPath })
  .delay(500)
  .then(function() {
    console.log(headLoc, JSON.stringify(helpers.getClickPosition(page, '[data-ta-current="true"]')))
    if (headLoc == JSON.stringify(helpers.getClickPosition(page, '[data-ta-current="true"]'))) {
      done("reset failed")
    } else {
      done();
    }
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown()
    .then(function() { done(); })
    .catch(done);
});

testsuite.runAllSuits();
