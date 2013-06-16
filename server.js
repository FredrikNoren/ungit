require('./bugsense').init('ungit-node');
var express = require('express');
var gitApi = require('./git-api');
var config = require('./config')();
var winston = require('winston');

var app = express();
var server = require('http').createServer(app);

gitApi.pathPrefix = '/api';

app.use(express.static(__dirname + '/public'));
gitApi.registerApi(app, server, config);


server.listen(config.port, function() {
	winston.info('Listening on port ' + config.port);
});
