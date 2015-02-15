
var async = require('async');
var cliColor = require('ansi-color');
var helpers = require('./helpers');

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
  var i = 0;
  function runNext() {
    if (i == testsuites.suites.length) {
      console.log('Finnished all test suites. Took ' + (Date.now() - startTime) / 1000 + 'sec (' + testsuites.suites.length + ' suites)');
      phantom.exit(0);
    }
    var suite = testsuites.suites[i];
    i++;
    helpers.log(cliColor.set('#### Running suite: ' + suite.name + ' (' + i + '/' + testsuites.suites.length + ')', 'blue'));
    suite.suite.run(suite.name, function() {
      helpers.log(cliColor.set('#### Done with suite: ' + suite.name + ' (' + i + '/' + testsuites.suites.length + ')', 'blue'));
      setTimeout(runNext, 1000);
    });
  }
  runNext();
}

function TestSuite(page, config) {
  this.page = page;
  this.config = config || {};
  this.config.timeout = this.config.timeout || 10000;
  this.tests = [];
}
TestSuite.prototype.test = function(name, description) {
  this.tests.push({ name: name, description: description });
}
TestSuite.prototype.run = function(suiteName, callback) {
  var self = this;
  var startTime = Date.now();
  async.series(this.tests.map(function(test, index) {
    var testFullName = suiteName + ' - ' + pad(index, 2) + ' ' + test.name;
    return function(callback) {
      helpers.log(cliColor.set('## Running test : ' + testFullName, 'magenta'));
      var timeout = setTimeout(function() {
        self.page.render('clicktests/screenshots/timeout.png')
        console.error('Test timeouted after ' + self.config.timeout + 'ms!');
        callback('timeout');
      }, self.config.timeout);
      self.page.render('clicktests/screenshots/' + testFullName + ' - before.png');
      test.description(function(err, res) {
        clearTimeout(timeout);
        self.page.render('clicktests/screenshots/' + testFullName + '.png');
        if (err) {
          helpers.log(JSON.stringify(err));
          helpers.log(cliColor.set('## Test failed: ' + testFullName, 'red'));
        }
        else helpers.log(cliColor.set('## Test ok: ' + testFullName, 'green'));
        callback(err, res);
      });
    }
  }), function(err) {
    if (err) {
      console.error('Tests failed!');
      phantom.exit(1);
    } else {
      console.log('All tests in suite ok! Took ' + (Date.now() - startTime) / 1000 + 'sec (' + self.tests.length + ' tests)');
      callback();
    }
  });
}

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}