
var superagent = require('superagent');

if (process.argv[2] == 'get') {
	superagent.agent().get('http://localhost:3000/api/credentials').end(function(err, res) {
		console.log('username=' + res.body.username);
		console.log('password=' + res.body.password);
	});
}
