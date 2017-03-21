var cliColor = require('ansi-color');
var helpers = require('./helpers');
var Bluebird = require('bluebird');

var testsuites = {};
module.exports = testsuites;
testsuites.suites = [];
testsuites.newSuite = function(name, page, config) {
  var suite = new TestSuite(page, config);
  testsuites.suites.push({ name: name, suite: suite });
  return suite;
}
testsuites.isRunning = false;
testsuites.runAllSuits = function() {
  if (testsuites.isRunning) return;
  testsuites.isRunning = true;
  var startTime = Date.now();
  return Bluebird.each(testsuites.suites, function(suite, i) {
    var suiteIdentifier = suite.name + ' (' + i + '/' + testsuites.suites.length + ')';
    helpers.log(cliColor.set('#### Running suite: ' + suiteIdentifier, 'blue'));
    return suite.suite.run(suite.name)
      .then(function() {
        helpers.log(cliColor.set('#### Done with suite: ' + suiteIdentifier, 'blue'));
      });
  }).then(function() {
    console.log('Finished all test suites. Took ' + (Date.now() - startTime) / 1000 + 'sec (' + testsuites.suites.length + ' suites)');
    phantom.exit(0);
  });
}

function TestSuite(page, config) {
  this.page = page;
  this.config = config || {};
  this.config.timeout = this.config.timeout || 60000;
  this.tests = [];
}
TestSuite.prototype.test = function(name, description) {
  this.tests.push({ name: name, description: description });
}
TestSuite.prototype.run = function(suiteName) {
  var self = this;
  var startTime = Date.now();

  return Bluebird.mapSeries(this.tests, function(test, index) {
      var testFullName = suiteName + ' - ' + pad(index, 2) + ' ' + test.name;
      helpers.log(cliColor.set('## Running test : ' + testFullName, 'magenta'));
      self.page.render('clicktests/screenshots/' + testFullName + ' - before.png');
      return test.description()
        .catch(function(err) {
          helpers.log(JSON.stringify(err));
          helpers.log(cliColor.set('## Test failed: ' + testFullName, 'red'));
          throw err;
        }).then(function() {
          helpers.log(cliColor.set('## Test ok: ' + testFullName, 'green'));
        });
    }).timeout(self.config.timeout)
    .then(function() {
      console.log('All tests in suite ok! Took ' + (Date.now() - startTime) / 1000 + 'sec (' + self.tests.length + ' tests)');
    }).catch(function(err) {
      console.error('Tests failed! - ', err);
      phantom.exit(1);
    });
}

// Ungit had an amazing foresight to not use leftpad and avoid it's chaos...
// https://www.theregister.co.uk/2016/03/23/npm_left_pad_chaos/
function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}
