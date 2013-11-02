
var expect = require('expect.js');
var async = require('async');
var cache = require('../source/utils/cache');

describe('cache', function () {

  it('should be invokable several times', function(done) {
    var i = 0;
    var f = cache(function(callback) {
      setTimeout(function() {
        callback(null, i++);
      }, 10);
    });
    async.parallel([
      function(done) { f(function(err, val) { expect(val).to.be(0); done(); }) },
      function(done) { f(function(err, val) { expect(val).to.be(0); done(); }) },
      function(done) { f(function(err, val) { expect(val).to.be(0); done(); }) },
      function(done) { setTimeout(function() { f(function(err, val) { expect(val).to.be(0); done(); }); }, 20); },
      function(done) { f(function(err, val) { expect(val).to.be(0); done(); }) },
      function(done) { f(function(err, val) { expect(val).to.be(0); done(); }) }
    ], function() {
      done();
    });
  });

  it('should work when failing', function(done) {
    var i = 0;
    var f = cache(function(callback) {
      setTimeout(function() {
        callback('error');
      }, 10);
    });
    async.parallel([
      function(done) { f(function(err, val) { expect(err).to.be('error'); done(); }) },
      function(done) { f(function(err, val) { expect(err).to.be('error'); done(); }) },
      function(done) { setTimeout(function() { f(function(err, val) { expect(err).to.be('error'); done(); }); }, 20); },
    ], function() {
      done();
    });
  });

  it('should be possible to invalidate cache', function(done) {
    var i = 0;
    var f = cache(function(callback) {
      setTimeout(function() {
        callback(null, i++);
      }, 10);
    });
    async.series([
      function(done) { f(function(err, val) { expect(val).to.be(0); done(); }) },
      function(done) { f.invalidate(); done(); },
      function(done) { f(function(err, val) { expect(val).to.be(1); done(); }) },
    ], function() {
      done();
    });
  });

  it('should work in synchronous code', function(done) {
    var i = 0;
    var f = cache(function(callback) {
      callback(null, i++);
    });
    async.series([
      function(done) { f(function(err, val) { expect(val).to.be(0); done(); }) },
      function(done) { f(function(err, val) { expect(val).to.be(0); done(); }) },
    ], function() {
      done();
    });
  });
});