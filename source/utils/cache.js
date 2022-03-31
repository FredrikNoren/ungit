const NodeCache = require('node-cache');
const md5 = require('blueimp-md5');
const funcMap = {}; // Will there ever be a use case where this is a cache with TTL? func registration with TTL?

class OurCache extends NodeCache {
  constructor() {
    super({ stdTTL: 0 });
  }

  /**
   * Get cached result associated with the key or execute a function to get the result.
   *
   * @param {string} [key]  - A key associated with a function to be executed.
   * @returns {Promise} - Promise either resolved with cached result of the function or rejected
   *                    with function not found.
   */
  resolveFunc(key) {
    let result = this.get(key);
    if (result !== undefined) {
      return Promise.resolve(result);
    }
    result = funcMap[key];
    if (result === undefined) {
      return Promise.reject(new Error(`Cache entry ${key} not found`));
    }
    try {
      result = result.func();
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve(result) // func is found, resolve, set with TTL and return result
      .then((r) => {
        this.set(key, r, funcMap[key].ttl);
        return r;
      });
  }

  /**
   * Register a function to cache it's result. If same key exists, key is deregistered and
   * registered again.
   *
   * @param {function} [func]           - Function to be executed to get the result.
   * @param {string}   [key=md5(func)]  - Key to retrieve cached function result. Default is
   *                                    `md5(func)`.
   * @param {number}   [ttl=0]          - Ttl in seconds to be used for the cached result of
   *                                    function. Default is `0`.
   * @returns {string} - Key to retrieve cached function result.
   */
  registerFunc(func, key, ttl) {
    if (typeof func !== 'function') {
      throw new Error('no function was passed in.');
    }

    key = key || md5(func);
    ttl = ttl || this.options.stdTTL;

    if (isNaN(ttl) || ttl < 0) {
      throw new Error('ttl value is not valid.');
    }

    if (funcMap[key]) {
      this.deregisterFunc(key);
    }

    funcMap[key] = {
      func: func,
      ttl: ttl,
    };

    return key;
  }

  /**
   * Immediately invalidate cached function result despite ttl value.
   *
   * @param {string} [key]  - A key associated with a function to be executed.
   */
  invalidateFunc(key) {
    this.del(key);
  }

  /**
   * Remove function registration and invalidate it's cached value.
   *
   * @param {string} [key]  - A key associated with a function to be executed.
   */
  deregisterFunc(key) {
    this.invalidateFunc(key);
    delete funcMap[key];
  }
}

module.exports = new OurCache();
