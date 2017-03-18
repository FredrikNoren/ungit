
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

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8458, rootPath: '/ungit12234' });
  environment.init().then(function() {
      bareRepoPath = environment.path + '/barerepo';
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: true, path: bareRepoPath }, { bare: false, path: testRepoPath, initCommits: 2 } ]);
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Open repo screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElementVisible(page, '.graph')
      .delay(1000)
      .then(function() { done(); })
      .catch(done);
  });
});

suite.test('Adding a remote', function(done) {
  helpers.click(page, '[data-ta-clickable="remotes-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="show-add-remote-dialog"]')
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
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Fetch from newly added remote', function(done) {
  helpers.click(page, '[data-ta-clickable="fetch"]');
  Bluebird.resolve()
    .delay(500)
    .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]') })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Remote delete check', function(done) {
  helpers.click(page, '[data-ta-clickable="remotes-menu"]');
  helpers.waitForElementVisible(page, '[data-ta-container="remotes"]')
    .then(function() {
      helpers.click(page, '[data-ta-clickable="myremote-remove"]');
      return helpers.waitForElementVisible(page, '[data-ta-container="yes-no-dialog"]')
    }).then(function() {
      helpers.click(page, '[data-ta-clickable="yes"]');
      return helpers.waitForElementVisible(page, '[data-ta-element="progress-bar"]')
    }).then(function() {
      return helpers.waitForElementNotVisible(page, '[data-ta-element="progress-bar"]');
    }).then(function() { done(); })
    .catch(done);
});


// ----------- CLONING -------------

var testClonePath;

suite.test('Enter path to test root', function(done) {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.selectAllText(page);
  helpers.write(page, environment.path + '\n');
  helpers.waitForElementVisible(page, '[data-ta-container="uninited-path-page"]')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Clone repository should bring you to repo page', function(done) {
  testClonePath = environment.path + '/testclone';
  helpers.click(page, '[data-ta-input="clone-url"]');
  helpers.write(page, testRepoPath);
  helpers.click(page, '[data-ta-input="clone-target"]');
  helpers.write(page, testClonePath);
  helpers.click(page, '[data-ta-clickable="clone-repository"]');
  helpers.waitForElementVisible(page, '[data-ta-container="repository-view"]')
    .then(function() {
      if (helpers.elementVisible(page, '[data-ta-container="remote-error-popup"]')) {
        throw new Error('Should not find remote error popup');
      }
    }).delay(1000)
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to fetch', function(done) {
  helpers.click(page, '[data-ta-clickable="fetch"]');
  helpers.waitForElementVisible(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]')
  .then(function() { return helpers.waitForElementNotVisible(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]'); })
  .then(function() { done(); })
  .catch(done);
});

suite.test('Should be possible to create and push a branch', function(done) {
  uiInteractions.createBranch(page, 'branchinclone')
    .then(function() { return uiInteractions.refAction(page, 'branchinclone', true, 'push', done); })
    .then(function() { done(); })
    .catch(done);
});

suite.test('Should be possible to force push a branch', function(done) {
  uiInteractions.moveRef(page, 'branchinclone', 'Init Commit 0')
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
    }).delay(500)
    .then(function() { done(); })
    .catch(done);
});

suite.test('Shutdown', function(done) {
  environment.shutdown()
    .then(function() { done(); })
    .catch(done);
});

testsuite.runAllSuits();
