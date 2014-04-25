var common = require('../common.js');
var cliColor = require('ansi-color');

var getAverage = function(array) {
  var sum = 0;
  for (var n = 0; n < array.length; n++) {
    sum += array[n];
  }
  return sum / array.length;
}

var runner = function(req, cmd, arg, runCount, done) {
  var results = [];
  var runCounter = 0;

  console.log('\t>> ' + cmd + ' performance test.');

  var toRun = function() {
    var timeStamp = Date.now();

    common.get(req, cmd, arg, function(err, res) {
      timeStamp = Date.now() - timeStamp;
      results.push(timeStamp);

      if (runCounter < runCount) {
        console.log('\t\t' + cmd + ' took ' + timeStamp + ' ms');
        runCounter++;

        toRun();
      } else {
        console.log('\t>> ' + cmd + ' took ' + cliColor.set(getAverage(results)+ ' ms', 'magenta') + ' in total');
        done();
      }
    });
  }
  toRun();
}
exports.runner = runner;
