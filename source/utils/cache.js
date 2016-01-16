'use strict';

const signals = require('signals');

// Wraps a function to produce one value at a time no matter how many times invoked, and cache that value until invalidated
module.exports = (constructValue) => {
  let constructDone;
  let hasCache = false;

  let f = (callback) => {
    if (hasCache) return callback(f.error, f.value);
    if (constructDone) return constructDone.add(callback);

    constructDone = new signals.Signal();
    let localConstructDone = constructDone;
    constructDone.add((err, val) => {
      constructDone = null;
      callback(err, val);
    });
    constructValue((err, value) => {
      hasCache = true;
      f.error = err;
      f.value = value;
      localConstructDone.dispatch(err, value);
    });
  };

  f.invalidate = () => {
    hasCache = false;
    f.error = null;
    f.value = null;
    constructDone = null;
  };

  return f;
}
