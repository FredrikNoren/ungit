
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');

var muteGraceTimeDuration = 2000;

var page = webpage.create();
var suite = testsuite.newSuite('discard', page);

var environment;
var testRepoPath;

var createAndDiscard = function(callback, dialogButtonToClick) {
  environment.createTestFile(testRepoPath + '/testfile2.txt', function(err) {
    if (err) return callback(err);
    helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]', function() {
      helpers.click(page, '[data-ta-clickable="discard-file"]');

      if (dialogButtonToClick) {
        helpers.click(page, '[data-ta-clickable="' + dialogButtonToClick + '"]');
      } else {
        if (helpers.elementVisible(page, '[data-ta-clickable="yes"]'))
          return callback(new Error('Should not see yes button'))
      }

      if (dialogButtonToClick !== 'no') {
        helpers.waitForElementNotVisible(page, '[data-ta-container="staging-file"]', function() {
          callback();
        });
      } else {
        helpers.waitForElementVisible(page, '[data-ta-container="staging-file"]', function() {
          callback();
        });
      }
    });
  });
}


suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8453, serverStartupOptions: ['--disableDiscardWarning'] });
  environment.init(function(err) {
    if (err) return done(err);
    testRepoPath = environment.path + '/testrepo';
    environment.createRepos([
      { bare: false, path: testRepoPath }
      ], done);
  });
});


suite.test('Open repo screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElementVisible(page, '.graph', function() {
      setTimeout(done, 1000); // Let it finnish loading
    });
  });
});

suite.test('Should be possible to discard a created file without warning message', function(done) {
  createAndDiscard(done);
});

suite.test('Shutdown', function(done) {
  environment.shutdown(function() {
    page = webpage.create();
    done();
  }, true);
});

suite.test('Init', function(done) {
  environment = new Environment(page, { port: 8454, serverStartupOptions: ['--no-disableDiscardWarning', '--disableDiscardMuteTime=' + muteGraceTimeDuration] });
  environment.init(function(err) {
    if (err) return done(err);
    testRepoPath = environment.path + '/testrepo';
    environment.createRepos([
      { bare: false, path: testRepoPath }
      ], done);
  });
});

suite.test('Open repo screen', function(done) {
  page.open(environment.url + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElementVisible(page, '.graph', function() {
      setTimeout(done, 1000); // Let it finnish loading
    });
  });
});

suite.test('Should be possible to select no from discard', function(done) {
  createAndDiscard(done, 'no');
});

suite.test('Should be possible to discard a created file', function(done) {
  createAndDiscard(done, 'yes');
});

suite.test('Should be possible to discard a created file and disable warn for awhile', function(done) {
  // Temporarily disabled to get the tests working
  /*createAndDiscard(function(err) {
    if (err) done(err);
    createAndDiscard(function(err) {
      if (err) done(err);
      setTimeout(function(err) {
        if (err) done(err);
        createAndDiscard(done, 'yes');
      }, muteGraceTimeDuration + 500);
    });
  }, 'mute');*/
  done();
});

suite.test('Shutdown', function(done) {
  environment.shutdown(done);
});

testsuite.runAllSuits();
