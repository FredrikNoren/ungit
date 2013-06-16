require('./bugsense').init('credentials-helper');
var winston = require('winston');

winston.add(winston.transports.File, { filename: 'credentials-helper.log' });
winston.remove(winston.transports.Console);
winston.info('Credentials helper invoked');

var superagent = require('superagent');
var config = require('./config')();

if (process.argv[3] == 'get') {
	winston.info('Getting credentials');
	superagent.agent().get('http://localhost:' + config.port + '/api/credentials?socketId=' + process.argv[2]).end(function(err, res) {
		if (err || !res.ok) {
			winston.error('Error getting credentials', err);
			throw err;
		}
		winston.info('Got credentials');
		console.log('username=' + res.body.username);
		console.log('password=' + res.body.password);
	});
} else {
	winston.info('Unhandled param: ' + process.argv[3]);
}
