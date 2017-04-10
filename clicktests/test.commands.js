
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('commands', page);

var environment;
var testRepoPath;

suite.test('Init', function() {
  environment = new Environment(page, {});
  return environment.init().then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    });
});

suite.test('Open path screen', function() {
  return uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function() { return helpers.waitForElementVisible(page, '.graph'); });
});

suite.test('add a branch-1', function() {
  return environment.createTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return uiInteractions.commit(page, 'commit-1'); })
    .then(function() { return helpers.waitForElementVisible(page, '.commit'); })
    .then(function() { return uiInteractions.createBranch(page, 'branch-1'); });
});

suite.test('add a branch-2', function() {
  return environment.createTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return uiInteractions.commit(page, 'commit-1'); })
    .then(function() { return helpers.waitForElementVisible(page, '.commit'); })
    .then(function() { return uiInteractions.createBranch(page, 'branch-2'); });
});

suite.test('test branch create from command line', function() {
  return environment.gitCommand({ command: ["branch", "gitCommandBranch"], repo: testRepoPath })
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-name="gitCommandBranch"]') });
});

suite.test('test branch move from command line', function() {
  var branchTagLoc = JSON.stringify(helpers.getClickPosition(page, '[data-ta-name="gitCommandBranch"]'));
  return environment.gitCommand({ command: ["branch", "-f", "gitCommandBranch", "branch-1"], repo: testRepoPath })
    .delay(1000)
    .then(function() {
      console.log(branchTagLoc, JSON.stringify(helpers.getClickPosition(page, '[data-ta-name="gitCommandBranch"]')))
      if (branchTagLoc == JSON.stringify(helpers.getClickPosition(page, '[data-ta-name="gitCommandBranch"]'))) {
        throw new Error("Branch haven't moved");
      }
    });
});

suite.test('test branch delete from command line', function() {
  return environment.gitCommand({ command: ["branch", "-D", "gitCommandBranch"], repo: testRepoPath })
    .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-name="gitCommandBranch"]'); });
});

suite.test('test tag create from command line', function() {
  return environment.gitCommand({ command: ["tag", "tag1"], repo: testRepoPath })
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-name="tag1"]') });
});

suite.test('test tag delete from command line', function() {
  return environment.gitCommand({ command: ["tag", "-d", "tag1"], repo: testRepoPath })
    .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-name="tag1"]') });
});

suite.test('test reset from command line', function() {
  var headLoc = JSON.stringify(helpers.getClickPosition(page, '[data-ta-current="true"]'));
  return environment.gitCommand({ command: ["reset", "branch-1"], repo: testRepoPath })
    .delay(500)
    .then(function() {
      console.log(headLoc, JSON.stringify(helpers.getClickPosition(page, '[data-ta-current="true"]')))
      if (headLoc == JSON.stringify(helpers.getClickPosition(page, '[data-ta-current="true"]'))) {
        throw new Error("reset failed")
      }
    });
});

suite.test('Shutdown', function() {
  return environment.shutdown();
});

testsuite.runAllSuits();
