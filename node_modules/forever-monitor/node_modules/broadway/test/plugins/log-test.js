/*
 * log-test.js: Tests for the broadway logger plugin
 *
 * (C) 2011, Nodejitsu Inc.
 * MIT LICENSE
 *
 */
 
var vows = require('vows'),
    events = require('eventemitter2'),
    assert = require('../helpers/assert'),
    helpers = require('../helpers/helpers'),
    macros = require('../helpers/macros'),
    broadway = require('../../lib/broadway');

var app = helpers.mockApp();
app.options = {
  log: {
    logAll: true,
    namespaces: {
      'apps': 'foo'
    }
  }
};

vows.describe('broadway/plugins/log').addBatch({
  "Using the log plugin": {
    "to extend an application": macros.shouldExtend(app, 'log', {
      "when the application emits log::# events": macros.shouldLogEvent(app, [
        'log::warn',
        'some warn message', 
        { foo: 'bar' }
      ], assert.log.msgMeta)
    }),
    "when the application emits log::#::# events": macros.shouldLogEvent(app, [
      'log::warn::some-category', 
      'some warn message', 
      { foo: 'bar' }
    ], assert.log.msgMeta),
    "when the application emits log events with": {
      "message and meta": macros.shouldLogEvent(app, [
        'log',
        'some info message',
        { foo: 'bar' },  
      ], assert.log.msgMeta),
      "level and message": macros.shouldLogEvent(app, [
        'log',
        'silly', 
        'some silly message', 
      ], assert.log.levelMsg),
      "level and meta": macros.shouldLogEvent(app, [
        'log',
        'info', 
        { foo: 'bar' }, 
      ], assert.log.levelMeta)
    },
    "when the application emits namespaced events with": {
      "level and meta": macros.shouldLogEvent(app, [
        'apps::start',
        'info', 
        { foo: 'bar' }, 
      ], assert.log.levelMeta),
      "meta only": macros.shouldLogEvent(app, [
        'apps::start',
        { foo: 'bar' }, 
      ], assert.log.metaOnly)
    }
  }
}).export(module);