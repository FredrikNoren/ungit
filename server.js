
var express = require('express');
var gitApi = require('./git-api');

var app = express();
var server = require('http').createServer(app);

gitApi.pathPrefix = '/api';

app.use(express.static(__dirname + '/public'));
gitApi.registerApi(app, server, true);


server.listen(3000);
console.log('Listening on port 3000');

