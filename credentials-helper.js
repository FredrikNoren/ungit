require('./bugsense').init();
var superagent = require('superagent');

if (process.argv[3] == 'get') {
	superagent.agent().get('http://localhost:3000/api/credentials?socketId=' + process.argv[2]).end(function(err, res) {
		if (err || !res.ok) throw err;
		console.log('username=' + res.body.username);
		console.log('password=' + res.body.password);
	});
} else {
	throw new Error('Unkown param: ' + process.argv[3]);
}
