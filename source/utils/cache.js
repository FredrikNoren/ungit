const Bluebird = require('bluebird');
const NodeCache = require('node-cache');
const cache = Bluebird.promisifyAll(new NodeCache({ stdTTL: 0, errorOnMissing: true }));
const md5 = require('blueimp-md5');
const funcMap = {}; // Will there ever be a use case where this is a cache with TTL? func registration with TTL?

/**
 * @function resolveFunc
 * @description Get cached result associated with the key or execute a function to get the result
 * @param {string} [key] - A key associated with a function to be executed.
 * @return {Promise} - Promise either resolved with cached result of the function or rejected with function not found.
 */
cache.resolveFunc = (key) => {
  return cache.getAsync(key) // Cant do `cache.getAsync(key, true)` due to `get` argument ordering...
    .catch({ errorcode: "ENOTFOUND" }, (e) => {
      if (!funcMap[key]) throw e;     // func associated with key is not found, throw not found error
      return getHardValue(funcMap[key].func()) // func is found, resolve, set with TTL and return result
        .then((r) => {
          return cache.setAsync(key, r, funcMap[key].ttl)
            .then(() => { return r; })
        });
    });
}

/**
 * @function getHardValue
 * @description In Linux, or certain settings, it seems that cached promises
 *   are not able to resolved and we need to cache raw result of promieses.
 * @param {prom} - raw value or promise to be returned or resolved
 * @param {promise} - a promise where next "then" will result in raw value.
 */
const getHardValue = (prom) => {
  if (prom.then) {
    return prom.then(getHardValue);
  } else {
    return Bluebird.resolve(prom);
  }
}

/**
 * @function registerFunc
 * @description Register a function to cache it's result. If same key exists, key is deregistered and registered again.
 * @param {ttl} [ttl=0] - ttl in seconds to be used for the cached result of function.
 * @param {string} [key=md5 of func] - Key to retrive cached function result.
 * @param {function} [func] - Function to be executed to get the result.
 * @return {string} - key to retrive cached function result.
 */
cache.registerFunc = (...args) => {
  let func = args.pop();
  let key = args.pop() || md5(func);
  let ttl = args.pop() || cache.options.stdTTL;

  if (typeof func !== "function") {
    throw new Error("no function was passed in.");
  }

  if (isNaN(ttl) || ttl < 0) {
    throw new Error("ttl value is not valid.");
  }

  if (funcMap[key]) {
    cache.deregisterFunc(key);
  }

  funcMap[key] = {
    func: func,
    ttl: ttl
  }

  return key;
}

/**
 * @function invalidateFunc
 * @description Immediately invalidate cached function result despite ttl value
 * @param {string} [key] - A key associated with a function to be executed.
 */
cache.invalidateFunc = (key) => {
  cache.del(key);
}

/**
 * @function deregisterFunc
 * @description Remove function registration and invalidate it's cached value.
 * @param {string} [key] - A key associated with a function to be executed.
 */
cache.deregisterFunc = (key) => {
  cache.invalidateFunc(key);
  delete funcMap[key];
}

module.exports = cache;
