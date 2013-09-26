

var winston = require('winston');
var version = require('./version');
var config = require('./config');

var os;
var superagent;
var uuid;

function BugTracker() {
	if (!config.bugtracking) return;

	var self = this;
	this.appVersion = 'unknown';
	version.getVersion(function(err, ungitVersion) {
		self.appVersion = ungitVersion;
		winston.info('BugTracker set version: ' + self.appVersion);
	});
}
module.exports = BugTracker;

BugTracker.prototype.notify = function(exception, clientName, callback) {
	if (!config.bugtracking) return;

	var self = this;
	if (!os) os = require('os');
	if (!superagent) superagent = require('superagent');
	if (!uuid) uuid = require('uuid');
	
	winston.info('Sending exception to bugsense');

	winston.query({ from: new Date - 1 * 60 * 60 * 1000, until: new Date }, function (err, logData) {
		if (err) {
			logData = { error: 'Error querying logdata', details: err };
		}

		var payload = {
			"client": {
				"name": clientName,
				//"version": "0.6"
			},
			"request": {
				"custom_data": {
					"log": JSON.stringify(logData)
				}
			},
			"exception": {
				"message": exception.message,
				"where": clientName,
				"klass": exception.name,
				"backtrace": exception.stack.toString()
			},
			"application_environment": {
				"phone": "PC",
				"appver": self.appVersion,
				"appname": "ungit",
				"osver": os.type(),
				"uid": uuid.v1()
			}
		};

		superagent.agent()
			.post('http://www.bugsense.com/api/errors')
			.set('X-BugSense-Api-Key', '3c48046e')
			.send(payload).end(function(err, res) {
				if (err || !res.ok || res.body.error) winston.info('Inception error sending error to bugsense', err, res ? res.body : 'no-body');
				else winston.info('Exception sent to bugsense');
				if (callback) callback();
			});
	
	});
};
