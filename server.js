
var express = require('express');
var gitApi = require('./git-api');
var rc = require('rc')('ungit', {
	port: 8448,
	gerritIntegration: false,
	dev: false
});

var app = express();
var server = require('http').createServer(app);

gitApi.pathPrefix = '/api';

app.use(express.static(__dirname + '/public'));
gitApi.registerApi(app, server, rc);


server.listen(rc.port, function() {
	console.log('Listening on port ' + rc.port);
});
