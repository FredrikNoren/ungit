
var superagent = require('superagent');
var uuid = require('uuid');
var os = require('os');
var winston = require('winston');

var bugsense = exports;

exports.notify = function(exception, clientName, callback) {
	
	winston.info('Sending exception to bugsense');

	superagent.agent()
		.post('http://www.bugsense.com/api/errors')
		.set('X-BugSense-Api-Key', '3c48046e')
		.send({
			"client": {
				"name": clientName,
				//"version": "0.6"
			}, 
			"exception": {
				"message": exception.message,
				"where": clientName,
				"klass": exception.name,
				"backtrace": exception.stack.toString()
			},
			"application_environment": {
				"phone": "PC",
				"appver": "unkown",
				"appname": "ungit",
				"osver": os.type(),
				"uid": uuid.v1()
			}
		}).end(function(err, res) {
			if (err || !res.ok) winston.info('Inception error sending error to bugsense', err);
			else winston.info('Exception sent to bugsense');
			if (callback) callback();
		});
	
};

exports.init = function(clientName) {
	process.on('uncaughtException', function(err) {
		bugsense.notify(err, clientName, function() {
			winston.error(err.stack);
			process.exit();
		});
	});
}