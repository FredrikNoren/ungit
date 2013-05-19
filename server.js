
var express = require('express');
var restGit = require('./rest-git');

var app = express();
var server = require('http').createServer(app);

restGit.pathPrefix = '/api';

app.use(express.static(__dirname + '/public'));
restGit.registerApi(app, server, true);


server.listen(3000);
console.log('Listening on port 3000');

