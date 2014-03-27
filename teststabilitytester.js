#!/usr/bin/env node

// This repeatedly runs the click and unit tests to verify their stability

var childProcess = require('child_process');
var moment = require('moment');

var runClickTest = function(callback) {
	var child =
  child.on('exit', function(code) {
    callback(null, code != 0);
  });
}

var count = 0;
var clickTestErrors = 0;
var unitTestErrors = 0;
var startTime = Date.now();
var run = function() {
  var testTime = Date.now();
  count++;
  console.log('Round ' + count + '...');
  var clickTestChild = childProcess.exec('grunt clicktest', function(err, stdout, stderr) {
    if (err) {
      clickTestErrors++;
      console.log(stdout);
      console.log(stderr);
      console.log('Clicktest failed!');
    }
    childProcess.exec('grunt unittest', function(err, stdout, stderr) {
      if (err) {
        unitTestErrors++;
        console.log(stdout);
        console.log(stderr);
        console.log('Unittest failed!');
      }
      console.log(count + ' test run, ' + clickTestErrors + ' clicktest errors (' + Math.floor(100*clickTestErrors/count) + '%), ' +
         unitTestErrors + ' unittest errors (' + Math.floor(100*unitTestErrors/count) + '%) ' +
        '(this round: ' + moment.duration(Date.now() - testTime).asSeconds() + 'sec, total: ' + moment.duration(Date.now() - startTime).humanize() + ')');
      run();
    });
  });
}
run();