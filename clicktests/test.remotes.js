
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('remotes', page);

var environment;

var bareRepoPath;
var testRepoPath;

suite.test('Init', function(done) {
  environment = new Environment(page);
  environment.init(function(err) {
    if (err) return done(err);
    bareRepoPath = environment.path + '/barerepo';
    testRepoPath = environment.path + '/testrepo';
    environment.createRepos([
      { bare: true, path: bareRepoPath },
      { bare: false, path: testRepoPath, initCommits: 2 }
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

suite.test('Adding a remote', function(done) {
  helpers.click(page, '[data-ta-clickable="remotes-menu"]');
  helpers.waitForElement(page, '[data-ta-clickable="show-add-remote-dialog"]', function() {
    helpers.click(page, '[data-ta-clickable="show-add-remote-dialog"]');
    helpers.waitForElement(page, '[data-ta-container="add-remote"]', function() {
      helpers.click(page, '[data-ta-container="add-remote"] [data-ta-input="name"]');
      helpers.write(page, 'myremote');
      helpers.click(page, '[data-ta-container="add-remote"] [data-ta-input="url"]');
      helpers.write(page, bareRepoPath);
      helpers.click(page, '[data-ta-container="add-remote"] [data-ta-clickable="submit"]');
      helpers.waitForElement(page, '[data-ta-container="remotes"] [data-ta-clickable="myremote"]', function() {
        done();
      });
    });
  });
});

suite.test('Fetch from newly added remote', function(done) {
  helpers.click(page, '[data-ta-clickable="fetch"]');
  helpers.waitForElement(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]', function() {
    helpers.waitForNotElement(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]', function() {
      done();
    });
  });
});

suite.test('Remote delete check', function(done) {
  helpers.click(page, '[data-ta-clickable="remotes-menu"]');
  helpers.waitForElement(page, '[data-ta-container="remotes"]', function() {
    helpers.click(page, '[data-ta-clickable="myremote-remove"]');
    helpers.waitForElement(page, '[data-ta-container="yes-no-dialog"]', function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      helpers.waitForElement(page, '[data-ta-element="progress-bar"]', function() {
        helpers.waitForNotElement(page, '[data-ta-element="progress-bar"]', function() {
          done();
        });
      });
    });
  });
});


// ----------- CLONING -------------

var testClonePath;

suite.test('Enter path to test root', function(done) {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.selectAllText(page);
  helpers.write(page, environment.path + '\n');
  helpers.waitForElement(page, '[data-ta-container="uninited-path-page"]', function() {
    done();
  });
});

suite.test('Clone repository should bring you to repo page', function(done) {
  testClonePath = environment.path + '/testclone';
  helpers.click(page, '[data-ta-input="clone-url"]');
  helpers.write(page, testRepoPath);
  helpers.click(page, '[data-ta-input="clone-target"]');
  helpers.write(page, testClonePath);
  helpers.click(page, '[data-ta-clickable="clone-repository"]');
  helpers.waitForElement(page, '[data-ta-container="repository-view"]', function() {
    helpers.expectNotFindElement(page, '[data-ta-container="remote-error-popup"]');
    setTimeout(function() { // Let animations finish
      done();
    }, 1000);
  });
});

suite.test('Should be possible to fetch', function(done) {
  helpers.click(page, '[data-ta-clickable="fetch"]');
  helpers.waitForElement(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]', function() {
    helpers.waitForNotElement(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]', function() {
      done();
    });
  });
});

suite.test('Should be possible to create and push a branch', function(done) {
  uiInteractions.createBranch(page, 'branchinclone', function() {
    uiInteractions.refAction(page, 'branchinclone', true, 'push', done);
  });
});

suite.test('Should be possible to force push a branch', function(done) {
  uiInteractions.moveRef(page, 'branchinclone', 'Init Commit 0', function() {
    helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="branchinclone"][data-ta-local="true"]');
    helpers.mousemove(page, '[data-ta-action="push"][data-ta-visible="true"]');
    setTimeout(function() { // Wait for next animation frame
      helpers.click(page, '[data-ta-action="push"][data-ta-visible="true"]');
      helpers.waitForElement(page, '[data-ta-container="yes-no-dialog"]', function() {
        helpers.click(page, '[data-ta-clickable="yes"]');
        helpers.waitForNotElement(page, '[data-ta-action="push"][data-ta-visible="true"]', function() {
          setTimeout(function() {
            done();
          }, 500);
        })
      });
    }, 200);
  });
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
