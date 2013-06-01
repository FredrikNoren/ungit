
var superagent = require('superagent');

if (process.argv[3] == 'get') {
	superagent.agent().get('http://localhost:3000/api/credentials?socketId=' + process.argv[2]).end(function(err, res) {
		console.log('username=' + res.body.username);
		console.log('password=' + res.body.password);
	});
}
