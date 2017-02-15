
var expect = require('expect.js');
var async = require('async');
var cache = require('../src/utils/cache');
var Bluebird = require('bluebird');

describe('cache', function () {
  it('should be invokable several times', function(done) {
    var i = 0;
    var key = cache.registerFunc(function() {
      return i++;
    });

    cache.resolveFunc(key)
      .then(function(val) { expect(val).to.be(0); })
      .then(function() { return cache.resolveFunc(key); })
      .then(function(val) { expect(val).to.be(0); })
      .then(done)
      .catch(done)
  });

  it('should work when failing', function(done) {
    var errorMsg = "A nasty error...";
    var key = cache.registerFunc(function() {
      throw new Error(errorMsg);
    });

    cache.resolveFunc(key)
      .then(function() { done("should have thrown exception!"); })
      .catch(function(e) {
        if (e.message === errorMsg) done();
        else done("error message does not match!");
      });
  });

  it('should be possible to invalidate cache', function(done) {
    var i = 0;
    var key = cache.registerFunc(function() {
      return i++;
    });

    cache.resolveFunc(key)
      .then(function(val) { expect(val).to.be(0); })
      .then(function() {
        cache.invalidateFunc(key);
        return cache.resolveFunc(key);
      }).then(function(val) { expect(val).to.be(1); })
      .then(done)
      .catch(done)
  });

  it('creating a same function with different keys', function(done) {
    var i = 0;
    var key1 = "func1";
    var key2 = "func2";
    var func = function() { return i++; }
    cache.registerFunc(key1, func);
    cache.registerFunc(key2, func)

    cache.resolveFunc(key1)
      .then(function(val) { expect(val).to.be(0); })
      .then(function() { return cache.resolveFunc(key1); })
      .then(function(val) { expect(val).to.be(0); })
      .then(function() { return cache.resolveFunc(key2); })
      .then(function(val) { expect(val).to.be(1); })
      .then(function() {
        cache.invalidateFunc(key1);
        return cache.resolveFunc(key1);
      }).then(function(val) { expect(val).to.be(2); })
      .then(function() { return cache.resolveFunc(key2); })
      .then(function(val) { expect(val).to.be(1); })
      .then(done)
      .catch(done)
  });

  it('Testing ttl', function(done) {
    var i = 0;
    var func = function() { return i++; }
    var key = cache.registerFunc(1, null, func);
    this.timeout(3000);

    cache.resolveFunc(key)
      .then(function(val) { expect(val).to.be(0); })
      .then(function() {
        return new Bluebird(function(resolve) {
          setTimeout(resolve, 500);
        });
      }).then(function() {
        return cache.resolveFunc(key)
      }).then(function(val) { expect(val).to.be(0); })
      .then(function() {
        return new Bluebird(function(resolve) {
          setTimeout(resolve, 1000);
        });
      }).then(function() {
        return cache.resolveFunc(key)
      }).then(function(val) { expect(val).to.be(1); })
      .then(function() {
        return new Bluebird(function(resolve) {
          setTimeout(resolve, 500);
        });
      }).then(function() {
        return cache.resolveFunc(key)
      }).then(function(val) { expect(val).to.be(1); })
      .then(done)
      .catch(done)
  });
});
