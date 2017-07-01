'use strict';
const expect = require('expect.js');
const environment = require('./environment')({ serverStartupOptions: ['--no-disableDiscardWarning'], rootPath: '/deep/root/path/to/app' });
const Bluebird = require('bluebird');
const mkdirp = Bluebird.promisifyAll(require("mkdirp")).mkdirPAsync;
const rimraf = Bluebird.promisify(require("rimraf"));
const testRepoPaths = [];

describe('test generic', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false, path: testRepoPat }]))
      // create a sub dir and change working dir to sub dir to prove functionality within subdir
      .then(() => testRepoPaths.push(`${testRepoPaths[0]}/asubdir`))
      .then(() => rimraf(testRepoPaths[1]))
      .then(() => mkdirp(testRepoPaths[1]));
  });
  after('Environment stop', () => environment.shutdown());

  it('Open repo screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[1]);
  });

  it('Check for refresh button', () => {
    return environment.nm.ug.wait('[data-ta-clickable="refresh-button"]')
      .ug.clcik('[data-ta-clickable="refresh-button"]');
  });

  it('Should be possible to create and commit a file', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.commit('init')
      .wait('.commit');
  });

  it('Should be possible to amend a file', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.amendCommit()
      .wait('.commit');
  });

  it('Should be able to add a new file to .gitignore', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/addMeToIgnore.txt`)
      .wait('[data-ta-container="staging-file"]')
      .ug.click('[data-ta-clickable="ignore-file"]')
      .ug.click('[data-ta-clickable="ignore-file"]')
      .ug.waitForElementNotVisible('[data-ta-container="staging-file"]');
  });

  it('Test showing commit diff between two commits', () => {
    return environment.nm.ug.wait('[data-ta-clickable="node-clickable-0"]')
      .ug.click('[data-ta-clickable="node-clickable-0"]')
      .wait('.diff-wrapper')
      .ug.click('[data-ta-clickable="commitDiffFileName"]')
      .wait('[data-ta-container="commitLineDiffs"]');
  });

  it('Test showing commit side by side diff between two commits', () => {
    return environment.nm.ug.click('[data-ta-clickable="commit-sideBySideDiff"]')
      .wait('[data-ta-container="commitLineDiffs"]');
  });

  it('Test wordwrap', () => {
    return environment.nm.ug.click('[data-ta-clickable="commit-wordwrap"]')
      .wait('.word-wrap');
  });

  it('Test wordwrap', () => {
    return environment.nm.ug.click('[data-ta-clickable="commit-whitespace"]')
      .wait('[data-ta-container="commitLineDiffs"]')
      .ug.click('[data-ta-clickable="node-clickable-0"]');
  });

  it('Should be possible to discard a created file and ensure patching is not avaliable for new file', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile2.txt`)
      .wait('[data-ta-container="staging-file"]')
      .ug.click('[data-ta-clickable="show-stage-diffs"]')
      .wait('[data-ta-container="staging-file"]')
      .ug.click('[data-ta-clickable="show-stage-diffs"]')
      .ug.waitForElementNotVisible('[data-ta-container="patch-file"]')
      .ug.click('[data-ta-clickable="discard-file"]')
      .ug.click('[data-ta-clickable="yes"]')
      .ug.waitForElementNotVisible('[data-ta-container="staging-file"]')
  });

  it('Should be possible to create a branch', () => {
    return environment.nm.ug.createBranch('testbranch');
  });

  it('Should be possible to create and destroy a branch', () => {
    return environment.nm.ug.createBranch('willbedeleted')
      .ug.click('[data-ta-clickable="branch"][data-ta-name="willbedeleted"]')
      .ug.click('[data-ta-action="delete"][data-ta-visible="true"]')
      .wait('[data-ta-container="yes-no-dialog"]')
      .ug.click('[data-ta-clickable="yes"]')
      .ug.waitForElementNotVisible('[data-ta-clickable="branch"][data-ta-name="willbedeleted"]');
  });

  it('Should be possible to create and destroy a tag', () => {
    return environment.nm.ug.createTag('tagwillbedeleted')
      .ug.click('[data-ta-clickable="tag"][data-ta-name="tagwillbedeleted"]')
      .ug.click('[data-ta-action="delete"][data-ta-visible="true"]')
      .wait('[data-ta-container="yes-no-dialog"]')
      .ug.click('[data-ta-clickable="yes"]')
      .ug.waitForElementNotVisible('[data-ta-clickable="tag"][data-ta-name="tagwillbedeleted"]');
  });

});




var testRepoPath; testRepoPaths[0]
var testRepoPathSubDir = testRepoPath/asubdir // testRepoPaths[1]









it('Commit changes to a file', () => {
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

it('Show stats for changed file and discard it', () => {
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

// it('Should be possible to patch a file', () => {
//   environment.changeTestFile(testRepoPath + '/testfile.txt', function(err) {
//     if (err) return done(err);
//     uiInteractions.patch(page, 'Patch', function() {
//       helpers.waitForElementVisible(page, '.commit', function() {
//         done();
//       });
//     });
//   });
// });

it('Checkout a branch', () => {
  uiInteractions.checkout(page, 'testbranch', done);
});

it('Create another commit', () => {
  environment.createTestFile(testRepoPath + '/testy2.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'Branch commit', done);
  });
});

it('Rebase', () => {
  uiInteractions.refAction(page, 'testbranch', true, 'rebase', done);
});

it('Checkout master again', () => {
  uiInteractions.checkout(page, 'master', done);
});

it('Create yet another commit', () => {
  environment.createTestFile(testRepoPath + '/testy3.txt', function(err) {
    if (err) return done(err);
    uiInteractions.commit(page, 'Branch commit', done);
  });
});

it('Merge', () => {
  uiInteractions.refAction(page, 'testbranch', true, 'merge', done);
});

it('Revert merge', () => {
  helpers.click(page, '[data-ta-clickable="node-clickable-0"]');
  helpers.waitForElementVisible(page, '[data-ta-action="revert"]', function() {
    helpers.click(page, '[data-ta-action="revert"]');
    helpers.waitForElementNotVisible(page, '[data-ta-container="user-error-page"]', function() {
      done();
    });
  });
});

it('Should be possible to move a branch', () => {
  uiInteractions.createBranch(page, 'movebranch', function() {
    uiInteractions.moveRef(page, 'movebranch', 'Init', done);
  });
});

it('Should be possible to click refresh button', () => {
  helpers.click(page, 'button.refresh-button');
  done();
});

// Shutdown
it('Go to home screen', () => {
  helpers.click(page, '[data-ta-clickable="home-link"]');
  helpers.waitForElementVisible(page, '[data-ta-container="home-page"]', function() {
    done();
  });
});

it('Shutdown server should bring you to connection lost page', () => {
  environment.shutdown(function() {
    helpers.waitForElementVisible(page, '[data-ta-container="user-error-page"]', function() {
      page.close();
      done();
    });
  }, true);
});

testsuite.runAllSuits();
