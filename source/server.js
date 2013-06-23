var config = require('./config')();
if (config.bugtracking) {
	var bugsense = require('./bugsense');
	bugsense.init('ungit-node');
}
var express = require('express');
var gitApi = require('./git-api');
var winston = require('winston');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var users = config.users;
config.users = null; // So that we don't send the users to the client

exports.start = function(callback) {

	if (config.authentication) {

		passport.serializeUser(function(username, done) {
		  done(null, username);
		});

		passport.deserializeUser(function(username, done) {
			done(null, users[username]);
		});

		passport.use(new LocalStrategy(function(username, password, done) {
		  	var password = users[username];
		  	if (users[username] && password == users[username])
		  		done(null, username);
		  	else
		  		done(null, false, { message: 'No such username/password' });
			}
		));
	}

	var app = express();
	var server = require('http').createServer(app);

	gitApi.pathPrefix = '/api';

	
	var ensureAuthenticated = function(req, res, next) { next(); };

	if (config.authentication) {
		app.use(express.cookieParser());
		app.use(express.bodyParser());
		app.use(express.session({ secret: 'ungit' }));
		app.use(passport.initialize());
		app.use(passport.session());

		app.post('/api/login', function(req, res, next) {
			passport.authenticate('local', function(err, user, info) {
				if (err) { return next(err) }
				if (!user) {
					res.json(401, { errorCode: 'authentication-failed', error: info.message });
					return;
				}
				req.logIn(user, function(err) {
					if (err) { return next(err); }
					res.json({ ok: true });
					return;
				});
			})(req, res, next);
		});

		app.get('/api/loggedin', function(req, res){
			if (req.isAuthenticated()) res.json({ loggedIn: true });
			else res.json({ loggedIn: false });
		});

		app.get('/api/logout', function(req, res){
			req.logout();
			res.json({ ok: true });
		});

		ensureAuthenticated = function(req, res, next) {
			if (req.isAuthenticated()) { return next(); }
			res.json(401, { errorCode: 'authentication-required', error: 'You have to authenticate to access this resource' });
		};
	}

	app.use(express.static(__dirname + '/../public'));
	gitApi.registerApi(app, server, ensureAuthenticated, config);

	app.get('/config.js', function(req, res) {
		res.send('config = ' + JSON.stringify(config));
	});

	// Error handling
	app.use(function(err, req, res, next) {
		if (config.bugtracking)
			bugsense.notify(err, 'ungit-node');
		winston.error(err.stack);
		res.send(500, { error: err.message, errorType: err.name, stack: err.stack });
	});

	server.listen(config.port, function() {
		winston.info('Listening on port ' + config.port);
		if(callback) callback();
	});

}