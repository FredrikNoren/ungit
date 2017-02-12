const Bluebird = require('bluebird');
const NodeCache = require('node-cache');
const cache = Bluebird.promisifyAll(new NodeCache({ stdTTL: 0, errorOnMissing: true }));
const md5 = require('blueimp-md5');
const funcMap = {}; // Will there ever be a use case where this is a cache with TTL? func registration with TTL?

cache.resolveFunc = (key) => {
  return cache.getAsync(key) // Cant do `cache.getAsync(key, true)` due to `get` argument ordering...
    .catch({ errorcode: "ENOTFOUND" }, (e) => {
      if (!funcMap[key]) throw e;     // func associated with key is not found, throw not found error
      const result = funcMap[key]();  // func is found, resolve, set with TTL and return result
      return cache.setAsync(key, result, cache.options.stdTTL)
        .then(() => { return result });
    });
}

cache.registerFunc = (key, func) => {
  let checkedKey = key;
  let checkedFunc = func;

  if (typeof key === "function") {
    checkedFunc = key
    checkedKey = md5(checkedFunc);
  }

  if (typeof checkedFunc !== "function") {
    throw new Error("no function was passed in");
  }

  if (funcMap[checkedKey]) {
    cache.deregisterFunc(checkedKey);
  }
  funcMap[checkedKey] = checkedFunc;

  return checkedKey;
}

cache.invalidateFunc = (key) => {
  cache.del(key);
}

cache.deregisterFunc = (key) => {
  cache.invalidateFunc(key);
  delete funcMap[key];
}

module.exports = cache;
