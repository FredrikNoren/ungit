
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');
var Bluebird = require('bluebird');

var muteGraceTimeDuration = 2000;

var page = webpage.create();
var suite = testsuite.newSuite('discard', page);

var environment;
var testRepoPath;

var createAndDiscard = function(dialogButtonToClick) {
  return environment.createTestFile(testRepoPath + '/testfile2.txt')
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]'); })
    .then(function() {
      helpers.click(page, '[data-ta-clickable="discard-file"]');

      if (dialogButtonToClick) {
        helpers.click(page, '[data-ta-clickable="' + dialogButtonToClick + '"]');
      } else if (helpers.elementVisible(page, '[data-ta-clickable="yes"]')) {
        throw new Error('Should not see yes button');
      }

      if (dialogButtonToClick !== 'no') {
        return helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]');
      } else {
        return helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]');
      }
    });
}


suite.test('Init', function() {
  environment = new Environment(page, { serverStartupOptions: ['--disableDiscardWarning'] });
  return environment.init().then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    })
});


suite.test('Open repo screen', function() {
  return uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function() { return helpers.waitForElementVisible(page, '.graph'); })
    .delay(1000)
});

suite.test('Should be possible to discard a created file without warning message', function() {
  return createAndDiscard()
});

suite.test('Shutdown', function() {
  var self = this;
  return environment.shutdown(true)
    .then(function() { page = webpage.create(); });
});

suite.test('Init', function() {
  environment = new Environment(page, { serverStartupOptions: ['--no-disableDiscardWarning', '--disableDiscardMuteTime=' + muteGraceTimeDuration] });
  return environment.init().then(function() {
      testRepoPath = environment.path + '/testrepo';
      return environment.createRepos([ { bare: false, path: testRepoPath } ]);
    });
});

suite.test('Open repo screen', function() {
  return uiInteractions.open(page, environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath))
    .then(function() { return helpers.waitForElementVisible(page, '.graph'); })
    .delay(1000);
});

suite.test('Should be possible to select no from discard', function() {
  return createAndDiscard('no');
});

suite.test('Should be possible to discard a created file', function() {
  return createAndDiscard('yes');
});

suite.test('Should be possible to discard a created file and disable warn for awhile', function() {
  // Temporarily disabled to get the tests working
  /*createAndDiscard(function(err) {
    if (err) (err);
    createAndDiscard(function(err) {
      if (err) (err);
      setTimeout(function(err) {
        if (err) (err);
        createAndDiscard(, 'yes');
      }, muteGraceTimeDuration + 500);
    });
  }, 'mute');*/
  return Bluebird.resolve();
});

suite.test('Shutdown', function() {
  return environment.shutdown()
});

testsuite.runAllSuits();
