
var superagent = require('superagent');
var uuid = require('uuid');

var bugsense = exports;

exports.notify = function(exception, callback) {
	
	console.log('Sending exception to bugsense');

	superagent.agent()
		.post('http://www.bugsense.com/api/errors')
		.set('X-BugSense-Api-Key', '3c48046e')
		.send({
			"client": {
				"name": "ungit-node",
				//"version": "0.6"
			}, 
			"exception": {
				"message": exception.message,
				"where": "unkown",
				"klass": exception.name,
				"backtrace": exception.stack.toString()
			},
			"application_environment": {
				"phone": "PC",
				"appver": "-",
				"appname": "ungit",
				"osver": "0",
				"uid": uuid.v1()
			}
		}).end(function(err, res) {
			if (err || !res.ok) console.log('Inception error sending error to bugsense', err);
			else console.log('Exception sent to bugsense');
			if (callback) callback();
		});
	
};

exports.init = function() {
	process.on('uncaughtException', function(err) {
		bugsense.notify(err, function() {
			console.log(err.stack);
			process.exit();
		});
	});
}