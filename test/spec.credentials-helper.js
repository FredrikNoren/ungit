
var expect = require('expect.js');
var child_process = require('child_process');
var path = require('path');
var http = require('http');
var config = require('../source/config');

describe('credentials-helper', function () {

	it('should be invokable', function(done) {
		var socketId = Math.floor(Math.random() * 1000);
		var payload = { username: 'testuser', password: 'testpassword' };
		var server = http.createServer(function (req, res) {
			expect(req.url).to.be('/api/credentials?socketId=' + socketId);
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(payload));
		});

		server.listen(config.port, '127.0.0.1');

		var command = 'node bin/credentials-helper' + ' ' + socketId + ' ' + config.port + ' get';
		child_process.exec(command, function(err, stdout, stderr) {
			expect(err).to.not.be.ok();
			var ss = stdout.split('\n');
			expect(ss[0]).to.be('username=' + payload.username);
			expect(ss[1]).to.be('password=' + payload.password);
			server.close();
			done();
		});
	});

});