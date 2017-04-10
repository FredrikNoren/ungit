
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

suite.test('Init', function() {
  environment = new Environment(page, { serverStartupOptions: ['--no-disableDiscardWarning'], rootPath: '/deep/root/path/to/app' });

  return environment.init().then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    }).then(function() {
      testRepoPathSubDir = testRepoPath + '/asubdir';
      if (!fs.makeDirectory(testRepoPathSubDir)) {
        throw new Error("failed to create tempDir")
      }
    });
});

suite.test('Open repo screen', function() {
  return uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPathSubDir))
    .then(function() { return helpers.waitForElementVisible(page, '.graph'); })
    .delay(100);
});

suite.test('Check for refresh button', function() {
  return helpers.waitForElementVisible(page, '[data-ta-clickable="refresh-button"]')
    .then(function() { helpers.click(page, '[data-ta-clickable="refresh-button"]'); })
    .delay(500);
});

suite.test('Should be possible to create and commit a file', function() {
  return environment.createTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return uiInteractions.commit(page, 'Init'); })
    .then(function() { return helpers.waitForElementVisible(page, '.commit'); });
});

suite.test('Should be possible to amend a file', function() {
  return environment.createTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return uiInteractions.amendCommit(page); })
    .then(function() { return helpers.waitForElementVisible(page, '.commit'); });
});

suite.test('Should be able to add a new file to .gitignore', function() {
  return environment.createTestFile(testRepoPath + '/addMeToIgnore.txt')
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]'); })
    .then(function() { helpers.click(page, '[data-ta-clickable="ignore-file"]'); })
    .delay(1000)
    .then(function() {
        helpers.click(page, '[data-ta-clickable="ignore-file"]');
        return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
    });
});

suite.test('Test showing commit diff between two commits', function() {
  return helpers.waitForElementVisible(page, '[data-ta-clickable="node-clickable-0"]').then(function() {
    helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
    return helpers.waitForElementVisible(page, '.diff-wrapper')
  }).then(function() {
    helpers.click(page, '[data-ta-clickable="commitDiffFileName"]');
    return helpers.waitForElementVisible(page, '[data-ta-container="commitLineDiffs"]');
  });
});

suite.test('Test showing commit side by side diff between two commits', function() {
  helpers.click(page, '[data-ta-clickable="commit-sideBySideDiff"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="commitLineDiffs"]')
    .delay(500);
});

suite.test('Test wordwrap', function() {
  helpers.click(page, '[data-ta-clickable="commit-wordwrap"]');
  return helpers.waitForElementVisible(page, '.word-wrap')
    .delay(500);
});

suite.test('Test wordwrap', function() {
  helpers.click(page, '[data-ta-clickable="commit-whitespace"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="commitLineDiffs"]')
    .delay(500)
    .then(function() { helpers.click(page, '[data-ta-clickable="node-clickable-0"]'); });
});

suite.test('Should be possible to discard a created file and ensure patching is not avaliable for new file', function() {
  return environment.createTestFile(testRepoPath + '/testfile2.txt')
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]'); })
    .then(function() { helpers.click(page, '[data-ta-clickable="show-stage-diffs"]'); })
    .delay(1000)
    .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-container="patch-file"]'); })
    .then(function() {
      helpers.click(page, '[data-ta-clickable="discard-file"]');
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
    });
});

suite.test('Should be possible to create a branch', function() {
  return uiInteractions.createBranch(page, 'testbranch');
});


suite.test('Should be possible to create and destroy a branch', function() {
  return uiInteractions.createBranch(page, 'willbedeleted')
    .then(function() {
      helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="willbedeleted"]');
      helpers.click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
      return helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]');
    }).then(function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"][data-ta-name="willbedeleted"]');
    });
});

suite.test('Should be possible to create and destroy a tag', function() {
  return uiInteractions.createTag(page, 'tagwillbedeleted')
    .then(function() {
      helpers.click(page, '[data-ta-clickable="tag"][data-ta-name="tagwillbedeleted"]');
      helpers.click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
      return helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]');
    }).then(function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-clickable="tag"][data-ta-name="tagwillbedeleted"]');
    });
});

suite.test('Commit changes to a file', function() {
  return environment.changeTestFile(testRepoPath + '/testfile.txt')
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]'); })
    .then(function() {
      helpers.click(page, '[data-ta-input="staging-commit-title"]')
      helpers.write(page, 'My commit message');
    }).delay(100)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="commit"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
    });
});

suite.test('Show stats for changed file and discard it', function() {
  return environment.changeTestFile(testRepoPath + '/testfile.txt')
    .then(function() {
      return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"] .additions');
    }).then(function(element) {
      if (element.textContent != '+1') {
        throw new Error('file additions do not match: expected: "+1" but was "' + element.textContent + '"');
      }
      helpers.click(page, '[data-ta-clickable="discard-file"]');
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
    });
});

// suite.test('Should be possible to patch a file', function() {
//   environment.changeTestFile(testRepoPath + '/testfile.txt', function(err) {
//     if (err) return (err);
//     uiInteractions.patch(page, 'Patch', function() {
//       helpers.waitForElementVisible(page, '.commit', function() {
//         ();
//       });
//     });
//   });
// });

suite.test('Checkout a branch', function() {
  return uiInteractions.checkout(page, 'testbranch')
});

suite.test('Create another commit', function() {
  return environment.createTestFile(testRepoPath + '/testy2.txt')
    .then(function() { return uiInteractions.commit(page, 'Branch commit'); })
});

suite.test('Rebase', function() {
  return uiInteractions.refAction(page, 'testbranch', true, 'rebase')
});

suite.test('Checkout master again', function() {
  return uiInteractions.checkout(page, 'master')
});

suite.test('Create yet another commit', function() {
  return environment.createTestFile(testRepoPath + '/testy3.txt')
    .then(function() { return uiInteractions.commit(page, 'Branch commit'); });
});

suite.test('Merge', function() {
  return uiInteractions.refAction(page, 'testbranch', true, 'merge');
});

suite.test('Revert merge', function() {
  helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
  return helpers.waitForElementVisible(page, '[data-ta-action="revert"]').then(function() {
    helpers.click(page, '[data-ta-action="revert"]');
    return helpers.waitForElementNotVisible(page, '[data-ta-container="user-error-page"]');
  });
});

suite.test('Should be possible to move a branch', function() {
  return uiInteractions.createBranch(page, 'movebranch')
    .then(function() { return uiInteractions.moveRef(page, 'movebranch', 'Init'); });
});

suite.test('Should be possible to click refresh button', function() {
  helpers.click(page, 'button.refresh-button');
  return Bluebird.resolve();
});

// Shutdown
suite.test('Go to home screen', function() {
  helpers.click(page, '[data-ta-clickable="home-link"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="home-page"]');
});

suite.test('Shutdown server should bring you to connection lost page', function() {
  return environment.shutdown(true);
});

testsuite.runAllSuits();
