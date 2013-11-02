

var winston = require('winston');
var sysinfo = require('./sysinfo');
var config = require('./config');

var os;
var superagent;
var uuid;

function BugTracker(subsystem) {
  if (!config.bugtracking) return;

  var self = this;

  this.raven = require('raven');
  this.client = new this.raven.Client('https://58f16d6f010d4c77900bb1de9c02185f:84b7432f56674fbc8522bc84cc7b30f4@app.getsentry.com/12434');

  this.subsystem = subsystem;

  this.appVersion = 'unknown';
  sysinfo.getUngitVersion(function(err, ungitVersion) {
    self.appVersion = ungitVersion;
    winston.info('BugTracker set version: ' + self.appVersion);
  });

  this.userHash = 'unkown';
  sysinfo.getUserHash(function(err, userHash) {
    self.userHash = userHash;
    winston.info('BugTracker set user hash');
  });
}
module.exports = BugTracker;

BugTracker.prototype.notify = function(exception, clientName, callback) {
  if (!config.bugtracking) return;

  var self = this;
  if (!os) os = require('os');
  if (!superagent) superagent = require('superagent');
  if (!uuid) uuid = require('uuid');

  var options = {
    user: { id: this.userHash },
    tags: {
      version: this.appVersion,
      subsystem: this.subsystem,
      deployment: config.desktopMode ? 'desktop' : 'web'
    }
  }

  this.client.captureException(exception, options);
};
