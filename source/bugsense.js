
var superagent = require('superagent');
var uuid = require('uuid');
var os = require('os');
var winston = require('winston');
var version = require('./version');

var bugsense = exports;

bugsense.appVersion = 'unknown';

bugsense.notify = function(exception, clientName, callback) {
	
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
				"appver": bugsense.appVersion,
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

bugsense.init = function(clientName, skipFindVersion) {
	process.on('uncaughtException', function(err) {
		winston.error(err.stack.toString());
		bugsense.notify(err, clientName, function() {
			process.exit();
		});
	});
	if (!skipFindVersion) {
		version.getVersion(function(ver) {
			bugsense.appVersion = ver;
			winston.info('App version: ' + bugsense.appVersion);
		})
	}
}