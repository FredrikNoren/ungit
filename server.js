var config = require('./config')();
if (config.bugtracking) {
	var bugsense = require('./bugsense');
	bugsense.init('ungit-node');
}
var express = require('express');
var gitApi = require('./git-api');
var winston = require('winston');

var app = express();
var server = require('http').createServer(app);

gitApi.pathPrefix = '/api';

app.use(express.static(__dirname + '/public'));
gitApi.registerApi(app, server, config);

app.get('/config.js', function(req, res) {
	res.send('config = ' + JSON.stringify(config));
});

app.use(function(err, req, res, next) {
	if (config.bugtracking)
		bugsense.notify(err, 'ungit-node');
	winston.error(err.stack);
	res.send(500, { error: err.message, errorType: err.name, stack: err.stack });
});

server.listen(config.port, function() {
	winston.info('Listening on port ' + config.port);
});
