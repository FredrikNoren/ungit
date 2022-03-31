'use strict';

const logger = require('./utils/logger');
const sysinfo = require('./sysinfo');
const config = require('./config');
const raven = require('raven-js');
const client = new raven.Client(
  'https://58f16d6f010d4c77900bb1de9c02185f:84b7432f56674fbc8522bc84cc7b30f4@app.getsentry.com/12434'
);

class BugTracker {
  constructor(subsystem) {
    if (!config.bugtracking) return;

    this.subsystem = subsystem;
    this.appVersion = 'unknown';
    this.userHash = sysinfo.getUserHash();
    this.appVersion = config.ungitDevVersion;
    logger.info(`BugTracker set version: ${this.appVersion}`);
  }
  notify(exception, clientName) {
    if (!config.bugtracking) return;

    const options = {
      user: { id: this.userHash },
      tags: {
        version: this.appVersion,
        subsystem: this.subsystem,
        deployment: config.desktopMode ? 'desktop' : 'web',
      },
    };

    client.captureException(exception, options);
  }
}
module.exports = BugTracker;
