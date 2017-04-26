
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');
var Bluebird = require('bluebird');

var page = webpage.create();
var suite = testsuite.newSuite('remotes', page);

var environment;

var bareRepoPath;
var testRepoPath;

suite.test('Init', function() {
  environment = new Environment(page, { rootPath: '/ungit12234' });
  return environment.init().then(function() {
      bareRepoPath = environment.path + '/barerepo';
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: true, path: bareRepoPath }, { bare: false, path: testRepoPath, initCommits: 2 } ]);
    });
});

suite.test('Open repo screen', function() {
  return uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function () { return helpers.waitForElementVisible(page, '.graph'); })
    .delay(1000)
});

suite.test('Adding a remote', function() {
  helpers.click(page, '[data-ta-clickable="remotes-menu"]');
  return helpers.waitForElementVisible(page, '[data-ta-clickable="show-add-remote-dialog"]')
    .then(function() {
      helpers.click(page, '[data-ta-clickable="show-add-remote-dialog"]');
      return helpers.waitForElementVisible(page, '[data-ta-container="add-remote"]');
    }).then(function() {
      helpers.click(page, '[data-ta-container="add-remote"] [data-ta-input="name"]');
      helpers.write(page, 'myremote');
      helpers.click(page, '[data-ta-container="add-remote"] [data-ta-input="url"]');
      helpers.write(page, bareRepoPath);
      helpers.click(page, '[data-ta-container="add-remote"] [data-ta-clickable="submit"]');
    }).delay(500)
    .then(function() {
      helpers.click(page, '[data-ta-clickable="remotes-menu"]');
      return helpers.waitForElementVisible(page, '[data-ta-container="remotes"] [data-ta-clickable="myremote"]');
    });
});

suite.test('Fetch from newly added remote', function() {
  helpers.click(page, '[data-ta-clickable="fetch"]');
  return Bluebird.resolve()
    .delay(500)
    .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]') })
});

suite.test('Remote delete check', function() {
  helpers.click(page, '[data-ta-clickable="remotes-menu"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="remotes"]')
    .then(function() {
      helpers.click(page, '[data-ta-clickable="myremote-remove"]');
      return helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]')
    }).then(function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementVisible(page, '[data-ta-element="progress-bar"]')
    }).then(function() {
      return helpers.waitForElementNotVisible(page, '[data-ta-element="progress-bar"]');
    });
});


// ----------- CLONING -------------

var testClonePath;

suite.test('Enter path to test root', function() {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.selectAllText(page);
  helpers.write(page, environment.path + '\n');
  return helpers.waitForElementVisible(page, '[data-ta-container="uninited-path-page"]')
});

suite.test('Clone repository should bring you to repo page', function() {
  testClonePath = environment.path + '/testclone';
  helpers.click(page, '[data-ta-input="clone-url"]');
  helpers.write(page, testRepoPath);
  helpers.click(page, '[data-ta-input="clone-target"]');
  helpers.write(page, testClonePath);
  helpers.click(page, '[data-ta-clickable="clone-repository"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="repository-view"]')
    .then(function() {
      if (helpers.elementVisible(page, '[data-ta-container="remote-error-popup"]')) {
        throw new Error('Should not find remote error popup');
      }
    }).delay(1000);
});

suite.test('Should be possible to fetch', function() {
  helpers.click(page, '[data-ta-clickable="fetch"]');
  return helpers.waitForElementVisible(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]')
    .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]'); })
});

suite.test('Should be possible to create and push a branch', function() {
  return uiInteractions.createBranch(page, 'branchinclone')
    .then(function() { return uiInteractions.refAction(page, 'branchinclone', true, 'push'); })
});

suite.test('Should be possible to force push a branch', function() {
  return uiInteractions.moveRef(page, 'branchinclone', 'Init Commit 0')
    .then(function() {
      helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="branchinclone"][data-ta-local="true"]');
      helpers.mousemove(page, '[data-ta-action="push"][data-ta-visible="true"]');
    }).delay(200)
    .then(function() {
      helpers.click(page, '[data-ta-action="push"][data-ta-visible="true"]');
      return helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]');
    }).then(function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementNotVisible(page, '[data-ta-action="push"][data-ta-visible="true"]');
    }).delay(500);
});

suite.test('Shutdown', function() {
  return environment.shutdown();
});

testsuite.runAllSuits();
