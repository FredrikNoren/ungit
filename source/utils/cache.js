
var signals = require('signals');

// Wraps a function to produce one value at a time no matter how many times invoked, and cache that value until invalidated
var cache = function(constructValue) {

  var constructDone;
  var hasCache = false;

  var f = function(callback) {

    if (hasCache) return callback(f.error, f.value);
    if (constructDone) return constructDone.add(callback);

    constructDone = new signals.Signal();
    var localConstructDone = constructDone;
    constructDone.add(function(err, val) {
      constructDone = null;
      callback(err, val);
    });
    constructValue(function(err, value) {
      hasCache = true;
      f.error = err;
      f.value = value;
      localConstructDone.dispatch(err, value);
    });
  };

  f.invalidate = function() {
    hasCache = false;
    f.error = null;
    f.value = null;
    constructDone = null;
  };

  return f;
}

module.exports = cache;