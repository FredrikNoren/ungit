
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var uiInteractions = require('./ui-interactions.js');
var webpage = require('webpage');
var page = webpage.create();
var suite = testsuite.newSuite('generic', page);
var fs = require('fs');

var environment;

var testRepoPath;
var testRepoPathSubDir;

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8455, serverStartupOptions: ['--no-disableDiscardWarning'], rootPath: '/deep/root/path/to/app' });
  environment.init(function(err) {
    if (err) return done(err);
    testRepoPath = environment.path + '/testrepo';
    environment.createRepos([ { bare: false, path: testRepoPath } ], function () {
      // create a sub dir and change working dir to sub dir to prove functionality within subdir
      testRepoPathSubDir = testRepoPath + '/asubdir';
      if (fs.makeDirectory(testRepoPathSubDir)) {
        done();
      } else {
        done("failed to make subdir");
      }
    });
  });
});

suite.test('Open repo screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPathSubDir), function () {
    helpers.waitForElementVisible(page, '.graph', function() {
      setTimeout(done, 1000); // Let it finnish loading
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

suite.test('Should be possible to create and commit a file', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'Init', function() {
      helpers.waitForElementVisible(page, '.commit', function() {
        done();
      });
    });
  });
});

suite.test('Should be possible to amend a file', function(done) {
  environment.createTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    uiInteractions.amendCommit(page, function() {
      helpers.waitForElementVisible(page, '.commit', function() {
        done();
      });
    });
  });
});

suite.test('Should be able to add a new file to .gitignore', function(done) {
  environment.createTestFile(testRepoPath + '/addMeToIgnore.txt', function(err) {
    if (err) return done(err);
    helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]', function() {
      // add "addMeToIgnore.txt" to .gitignore
      helpers.click(page, '[data-ta-clickable="ignore-file"]');
      // add ".gitignore" to .gitignore
      //TODO I'm not sure what is the best way to detect page refresh, so currently wait for 1 sec and then click ignore-file.
      setTimeout(function() {
        helpers.click(page, '[data-ta-clickable="ignore-file"]');
        helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]', function() {
          done();
        });
      }, 1000);
    });
  });
});

suite.test('Test showing commit diff between two commits', function(done) {
  helpers.waitForElementVisible(page, '[data-ta-clickable="node-clickable-0"]', function() {
    helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
    helpers.waitForElementVisible(page, '.diff-wrapper', function() {
      helpers.click(page, '[data-ta-clickable="commitDiffFileName"]');
      helpers.waitForElementVisible(page, '[data-ta-container="commitLineDiffs"]', function() {
        done();
      });
    });
  });
});

suite.test('Test showing commit side by side diff between two commits', function(done) {
  helpers.click(page, '[data-ta-clickable="commit-sideBySideDiff"]');
  helpers.waitForElementVisible(page, '[data-ta-container="commitLineDiffs"]', function() {
    setTimeout(function() {
      done();
    }, 500);
  });
});

suite.test('Test wordwrap', function(done) {
  helpers.click(page, '[data-ta-clickable="commit-wordwrap"]');
  helpers.waitForElementVisible(page, '.word-wrap', function() {
    setTimeout(function() {
      done();
    }, 500);
  });
});

suite.test('Test wordwrap', function(done) {
  helpers.click(page, '[data-ta-clickable="commit-whitespace"]');
  helpers.waitForElementVisible(page, '[data-ta-container="commitLineDiffs"]', function() {
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
      done();
    }, 500);
  });
});

suite.test('Should be possible to discard a created file and ensure patching is not avaliable for new file', function(done) {
  environment.createTestFile(testRepoPath + '/testfile2.txt', function(err) {
    if (err) return done(err);
    helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]', function() {
      helpers.click(page, '[data-ta-clickable="show-stage-diffs"]');
      setTimeout(function() {
        helpers.waitForElementNotVisible(page, '[data-ta-container="patch-file"]', function() {
          helpers.click(page, '[data-ta-clickable="discard-file"]');
          helpers.click(page, '[data-ta-clickable="yes"]');
          helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]', function() {
            done();
          });
        });
      }, 1000);
    });
  });
});

suite.test('Should be possible to create a branch', function(done) {
  uiInteractions.createBranch(page, 'testbranch', done);
});


suite.test('Should be possible to create and destroy a branch', function(done) {
  uiInteractions.createBranch(page, 'willbedeleted', function() {
    helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="willbedeleted"]');
    helpers.click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
    helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]', function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      helpers.waitForElementNotVisible(page, '[data-ta-clickable="branch"][data-ta-name="willbedeleted"]', function() {
        done();
      });
    });
  });
});

suite.test('Should be possible to create and destroy a tag', function(done) {
  uiInteractions.createTag(page, 'tagwillbedeleted', function() {
    helpers.click(page, '[data-ta-clickable="tag"][data-ta-name="tagwillbedeleted"]');
    helpers.click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
    helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]', function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      helpers.waitForElementNotVisible(page, '[data-ta-clickable="tag"][data-ta-name="tagwillbedeleted"]', function() {
        done();
      });
    });
  });
});

suite.test('Commit changes to a file', function(done) {
environment.changeTestFile(testRepoPath + '/testfile.txt', function(err) {
  if (err) return done(err);
  helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]', function() {
    helpers.click(page, '[data-ta-input="staging-commit-title"]')
    helpers.write(page, 'My commit message');
    setTimeout(function() {
      helpers.click(page, '[data-ta-clickable="commit"]');
      helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]', function() {
        done();
        });
      }, 100);
    });
  });
});

suite.test('Show stats for changed file and discard it', function(done) {
  environment.changeTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    helpers.waitForElementVisible(page, '[data-ta-container="staging-file"] .additions', function(element) {
      if (element.textContent != '+1') {
        return done(new Error('file additions do not match: expected: "+1" but was "' + element.textContent + '"'));
      }
      helpers.waitForElementVisible(page, '[data-ta-container="staging-file"] .deletions', function(element) {
        if (element.textContent != '-1') {
          return done(new Error('file deletions do not match: expected: "-1" but was "' + element.textContent + '"'));
        }
        helpers.click(page, '[data-ta-clickable="discard-file"]');
        helpers.click(page, '[data-ta-clickable="yes"]');
        helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]', function() {
          done();
        });
      });
    });
  });
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
  uiInteractions.checkout(page, 'testbranch', done);
});

suite.test('Create another commit', function(done) {
  environment.createTestFile(testRepoPath + '/testy2.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'Branch commit', done);
  });
});

suite.test('Rebase', function(done) {
  uiInteractions.refAction(page, 'testbranch', true, 'rebase', done);
});

suite.test('Checkout master again', function(done) {
  uiInteractions.checkout(page, 'master', done);
});

suite.test('Create yet another commit', function(done) {
  environment.createTestFile(testRepoPath + '/testy3.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'Branch commit', done);
  });
});

suite.test('Merge', function(done) {
  uiInteractions.refAction(page, 'testbranch', true, 'merge', done);
});

suite.test('Revert merge', function(done) {
  helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
  helpers.waitForElementVisible(page, '[data-ta-action="revert"]', function() {
    helpers.click(page, '[data-ta-action="revert"]');
    helpers.waitForElementNotVisible(page, '[data-ta-container="user-error-page"]', function() {
      done();
    });
  });
});

suite.test('Should be possible to move a branch', function(done) {
  uiInteractions.createBranch(page, 'movebranch', function() {
    uiInteractions.moveRef(page, 'movebranch', 'Init', done);
  });
});

suite.test('Should be possible to click refresh button', function(done) {
  helpers.click(page, 'button.refresh-button');
  done();
});

// Shutdown
suite.test('Go to home screen', function(done) {
  helpers.click(page, '[data-ta-clickable="home-link"]');
  helpers.waitForElementVisible(page, '[data-ta-container="home-page"]', function() {
    done();
  });
});

suite.test('Shutdown server should bring you to connection lost page', function(done) {
  environment.shutdown(function() {
    helpers.waitForElementVisible(page, '[data-ta-container="user-error-page"]', function() {
      page.close();
      done();
    });
  }, true);
});

testsuite.runAllSuits();
