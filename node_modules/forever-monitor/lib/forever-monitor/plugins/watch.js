/*
 * logger.js: Plugin for `Monitor` instances which adds file watching.
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */

var fs = require('fs'),
    path = require('path'),
    minimatch = require('minimatch'),
    watch = require('watch');

exports.name = 'watch';

//
// ### @private function _watchFilter
// #### @file {string} File name
// Determines whether we should restart if `file` change (@mikeal's filtering
// is pretty messed up).
//
function watchFilter(fileName) {
  if (this.watchIgnoreDotFiles && path.basename(fileName)[0] === '.') {
    return false;
  }

  for (var key in this.watchIgnorePatterns) {
    if (minimatch(fileName, this.watchIgnorePatterns[key], { matchBase: this.watchDirectory })) {
      return false;
    }
  }

  return true;
};

//
// ### function attach (options)
// #### @options {Object} Options for attaching to `Monitor`
//
// Attaches functionality for logging stdout and stderr to `Monitor` instances.
//
exports.attach = function () {
  var monitor = this;

  fs.readFile(path.join(this.watchDirectory, '.foreverignore'), 'utf8', function (err, data) {
    if (err) {
      return monitor.emit('watch:error', {
        message: 'Could not read .foreverignore file.',
        error: err.message
      });
    }

    Array.prototype.push.apply(monitor.watchIgnorePatterns, data.split('\n'));
  });

  watch.watchTree(this.watchDirectory, function (f, curr, prev) {
    if (!(curr === null && prev === null && typeof f === 'object')) {
      //
      // `curr` == null && `prev` == null && typeof f == "object" when watch
      // finishes walking the tree to add listeners. We don't need to know
      // about it, so we simply ignore it (anything different means that
      // some file changed/was removed/created - that's what we want to know).
      //
      if (watchFilter.call(monitor, f)) {
        monitor.emit('watch:restart', { file: f, stat: curr });
        monitor.restart();
      }
    }
  });
};