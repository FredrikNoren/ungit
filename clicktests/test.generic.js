
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var uiInteractions = require('./ui-interactions.js');
var webpage = require('webpage');
var page = webpage.create();
var suite = testsuite.newSuite('generic', page);
var Bluebird = require('bluebird');
var fs = require('fs');

var environment;

var testRepoPath;
var testRepoPathSubDir;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8455, serverStartupOptions: ['--no-disableDiscardWarning'], rootPath: '/deep/root/path/to/app' });

  environment.init().then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    }).then(function() {
      testRepoPathSubDir = testRepoPath + '/asubdir';
      if (!fs.makeDirectory(testRepoPathSubDir)) {
        throw new Error("failed to create tempDir")
      }
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Open repo screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPathSubDir), function () {
    helpers.waitForElementVisible(page, '.graph')
      .delay(100)
      .then(function() { done(); })
      .catch(done);
  });
});

suite.test('Check for refresh button', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="refresh-button"]')
    .then(function() { helpers.click(page, '[data-ta-clickable="refresh-button"]'); })
    .delay(500)
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to create and commit a file', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return uiInteractions.commit(page, 'Init'); })
    .then(function() { return helpers.waitForElementVisible(page, '.commit'); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to amend a file', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return uiInteractions.amendCommit(page); })
    .then(function() { return helpers.waitForElementVisible(page, '.commit'); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be able to add a new file to .gitignore', function(done) {
  environment.createTestFile(testRepoPath + '/addMeToIgnore.txt')
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]'); })
    .then(function() { helpers.click(page, '[data-ta-clickable="ignore-file"]'); })
    .delay(1000)
    .then(function() {
        helpers.click(page, '[data-ta-clickable="ignore-file"]');
        return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Test showing commit diff between two commits', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="node-clickable-0"]').then(function() {
    helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
    return helpers.waitForElementVisible(page, '.diff-wrapper')
  }).then(function() {
    helpers.click(page, '[data-ta-clickable="commitDiffFileName"]');
    return helpers.waitForElementVisible(page, '[data-ta-container="commitLineDiffs"]');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('Test showing commit side by side diff between two commits', function(done) {
  helpers.click(page, '[data-ta-clickable="commit-sideBySideDiff"]');
  helpers.waitForElementVisible(page, '[data-ta-container="commitLineDiffs"]')
    .delay(500)
    .then(function() { done(); })
    .catch(done);
});

suite.test('Test wordwrap', function(done) {
  helpers.click(page, '[data-ta-clickable="commit-wordwrap"]');
  helpers.waitForElementVisible(page, '.word-wrap')
    .delay(500)
    .then(function() { done(); })
    .catch(done);
});

suite.test('Test wordwrap', function(done) {
  helpers.click(page, '[data-ta-clickable="commit-whitespace"]');
  helpers.waitForElementVisible(page, '[data-ta-container="commitLineDiffs"]')
    .delay(500)
    .then(function() { helpers.click(page, '[data-ta-clickable="node-clickable-0"]'); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to discard a created file and ensure patching is not avaliable for new file', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt')
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]'); })
    .then(function() { helpers.click(page, '[data-ta-clickable="show-stage-diffs"]'); })
    .delay(1000)
    .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-container="patch-file"]'); })
    .then(function() {
      helpers.click(page, '[data-ta-clickable="discard-file"]');
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
    })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to create a branch', function(done) {
  uiInteractions.createBranch(page, 'testbranch')
    .then(function() { done(); })
    .catch(done);
});


suite.test('Should be possible to create and destroy a branch', function(done) {
  uiInteractions.createBranch(page, 'willbedeleted')
    .then(function() {
      helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="willbedeleted"]');
      helpers.click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
      return helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]');
    }).then(function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"][data-ta-name="willbedeleted"]');
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to create and destroy a tag', function(done) {
  uiInteractions.createTag(page, 'tagwillbedeleted')
    .then(function() {
      helpers.click(page, '[data-ta-clickable="tag"][data-ta-name="tagwillbedeleted"]');
      helpers.click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
      return helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]');
    }).then(function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-clickable="tag"][data-ta-name="tagwillbedeleted"]');
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Commit changes to a file', function(done) {
  environment.changeTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]'); })
    .then(function() {
      helpers.click(page, '[data-ta-input="staging-commit-title"]')
      helpers.write(page, 'My commit message');
    }).delay(100)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="commit"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Show stats for changed file and discard it', function(done) {
  environment.changeTestFile(testRepoPath + '/testfile.txt')
    .then(function() {
      return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"] .additions');
    }).then(function(element) {
      if (element.textContent != '+1') {
        throw new Error('file additions do not match: expected: "+1" but was "' + element.textContent + '"');
      }
      helpers.click(page, '[data-ta-clickable="discard-file"]');
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
    }).then(function() { done(); })
    .catch(done);
});

// suite.test('Should be possible to patch a file', function(done) {
//   environment.changeTestFile(testRepoPath + '/testfile.txt', function(err) {
//     if (err) return done(err);
//     uiInteractions.patch(page, 'Patch', function() {
//       helpers.waitForElementVisible(page, '.commit', function() {
//         done();
//       });
//     });
//   });
// });

suite.test('Checkout a branch', function(done) {
  uiInteractions.checkout(page, 'testbranch')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Create another commit', function(done) {
  environment.createTestFile(testRepoPath + '/testy2.txt')
    .then(function() { return uiInteractions.commit(page, 'Branch commit'); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Rebase', function(done) {
  uiInteractions.refAction(page, 'testbranch', true, 'rebase')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Checkout master again', function(done) {
  uiInteractions.checkout(page, 'master')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Create yet another commit', function(done) {
  environment.createTestFile(testRepoPath + '/testy3.txt')
    .then(function() { return uiInteractions.commit(page, 'Branch commit', done); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Merge', function(done) {
  uiInteractions.refAction(page, 'testbranch', true, 'merge')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Revert merge', function(done) {
  helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
  helpers.waitForElementVisible(page, '[data-ta-action="revert"]').then(function() {
    helpers.click(page, '[data-ta-action="revert"]');
    return helpers.waitForElementNotVisible(page, '[data-ta-container="user-error-page"]');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('Should be possible to move a branch', function(done) {
  uiInteractions.createBranch(page, 'movebranch', function() {
    return uiInteractions.moveRef(page, 'movebranch', 'Init');
  }).then(function() { done(); })
  .catch(done);
});

suite.test('Should be possible to click refresh button', function(done) {
  helpers.click(page, 'button.refresh-button');
  done();
});

// Shutdown
suite.test('Go to home screen', function(done) {
  helpers.click(page, '[data-ta-clickable="home-link"]');
  helpers.waitForElementVisible(page, '[data-ta-container="home-page"]')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Shutdown server should bring you to connection lost page', function(done) {
  var self = this;
  environment.shutdown(true)
    .then(function() { done(); })
    .catch(done);
});

testsuite.runAllSuits();
