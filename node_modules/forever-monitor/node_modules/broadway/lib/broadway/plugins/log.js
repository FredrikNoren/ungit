/*
 * log.js: Default logging plugin which attachs winston to App instances
 *
 * (C) 2011, Nodejitsu Inc.
 * MIT LICENSE
 *
 */

var winston = require('winston'),
    common = require('../common');

var log = exports;

//
// ### Setup default state for the exceptions plugin
//
log.name   = 'log';
log.ignore = ['broadway'];

//
// ### function attach (options)
// #### @options {Object} Options for this plugin
// Extends `this` (the application) with logging functionality from `winston`.
//
log.attach = function (options) {
  options  = options || {};

  var app = this,
      namespaces,
      logAll;

  if (this.config) {
    //
    // Merge options with any pre-existing application config.
    //
    options = common.mixin({}, options, this.config.get('log') || {});
  }

  //
  // Setup namespaces and then remove them from
  // `options` so they are not caught by `winston`.
  //
  namespaces = options.namespaces || {};
  delete options.namespaces;

  logAll = options.logAll || false;
  if (options.logAll) {
    delete options.logAll;
  }

  //
  // Hoist up relelvant logging functions onto the app
  // if requested.
  //
  this.log = new winston.Container(options);
  this.log.namespaces = namespaces;
  this.log.get('default').extend(this.log);

  //
  // Set the default console loglevel to options.level
  //
  this.log.get('default').transports.console.level = options.level || 'info';

  Object.defineProperty(this.log, 'logAll', {
    get: function () {
      return this._logAll;
    },
    set: function (val) {
      if (val === this._logAll) {
        //
        // If the value is identical return
        //
        return;
      }

      if (val) {
        app.onAny(log.logEvent);
        app.off(['log'], log.logEvent);
        app.off(['log', '*'], log.logEvent);
        app.off(['log', '*', '*'], log.logEvent);
      }
      else {
        app.offAny(log.logEvent);
        app.on(['log'], log.logEvent);
        app.on(['log', '*'], log.logEvent);
        app.on(['log', '*', '*'], log.logEvent);
      }

      this._logAll = val;
    }
  });

  //
  // Listen to relevant `app` events and
  // log them appropriately.
  //
  this.log.logAll = logAll;

  //
  // Add any namespaced containers to this App instance.
  //
  Object.keys(this.log.namespaces).forEach(function (namespace) {
    app.log.add(app.log.namespaces[namespace]);
  });
};

//
// ### function logEvent ([level], msg, meta)
// #### @msg {string} Message to log
// #### @meta {Object} **Optional** Metadata to log
// Logs the specified `msg` and `meta` according to
// the following conditions:
//
// #### `log` events
// 1. `log` - Logs to the default logger and level.
// 2. `log::[level]` - Logs to the default logger.
// 3. `log::[level]::[namespace]` - Logs to a namespaced logger.
//
// ### `[namespaced]` events
// If `app.log.logAll` is set, then find a logger at `namespace`,
// otherwise the default logger is used.
//
// 1. `[namespace]::**(level, msg, meta)` - Logs the event as the
//    message to the logger for the specified namespace and level.
// 2. `[namespace]::[level]::**(msg, meta)` - Logs the event and
//    the message to the logger for the specified namespace and level.
//
log.logEvent = function (/* level, msg, meta */) {
  var parts = Array.isArray(this.event) ? this.event : this.event.split(this.delimiter),
      ev = parts[0],
      namespace,
      logger,
      level,
      meta,
      msg;

  if (log.ignore.indexOf(ev) !== -1) {
    return;
  }

  //
  // Determine the `namespace` to log the event to
  //
  if (ev === 'log') {
    namespace = parts[2] || 'default';
    logger = this.log.get('default');
  }
  else if (this.log.logAll) {
    namespace = this.log.namespaces[ev] ? this.log.namespaces[ev] : 'default';
    logger = this.log.get(namespace);
  }
  else {
    return;
  }

  //
  // Parse arguments now that we have the logger.
  //
  Array.prototype.slice.call(arguments).forEach(function (a) {
    switch (typeof a) {
      case 'object': {
        meta = a;
        break;
      }
      case 'string': {
        if (logger[a]) {
          level = a;
        }
        else {
          msg = a;
        }
      }
    }
  });

  if (ev === 'log') {
    level = parts[1] || level || 'info';
  }
  else if (this.log.logAll) {
    if (logger[parts[1]]) {
      level = parts[1];
      parts.splice(1, 1);
    }
  }

  if (level in logger.levels === false) {
    level = 'info';
  }

  parts = parts.join(this.delimiter);
  meta = meta || {};
  msg = msg || parts;
  logger.log(level, msg, meta);
  this.emit(['broadway', 'logged'], level, msg, meta, parts);
};
