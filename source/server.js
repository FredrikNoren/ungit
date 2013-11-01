var config = require('./config');
var BugTracker = require('./bugtracker');
var bugtracker = new BugTracker('server');
var usageStatistics = require('./usage-statistics');
var express = require('express');
var gitApi = require('./git-api');
var winston = require('winston');
var sysinfo = require('./sysinfo');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var semver = require('semver');
var path = require('path');
var fs = require('fs');
var async = require('async');
var signals = require('signals');

process.on('uncaughtException', function(err) {
	winston.error(err.stack.toString());
	async.parallel([
		bugtracker.notify.bind(bugtracker, err, 'ungit-server'),
		usageStatistics.addEvent.bind(usageStatistics, 'server-exception')
	], function() {
		process.exit();
	});
});


winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'timestamp':true});
if (config.logDirectory)
	winston.add(winston.transports.File, { filename: path.join(config.logDirectory, 'server.log'), maxsize: 100*1024, maxFiles: 2 });

var users = config.users;
config.users = null; // So that we don't send the users to the client

if (config.authentication) {

	passport.serializeUser(function(username, done) {
	  done(null, username);
	});

	passport.deserializeUser(function(username, done) {
		done(null, users[username]);
	});

	passport.use(new LocalStrategy(function(username, password, done) {
	  	if (users[username] !== undefined && password === users[username])
	  		done(null, username);
	  	else
	  		done(null, false, { message: 'No such username/password' });
		}
	));
}

var app = express();
var server = require('http').createServer(app);

gitApi.pathPrefix = '/api';

if (config.logRESTRequests) {
	app.use(function(req, res, next){
		winston.info(req.method + ' ' + req.url);
		next();
	});
}

var noCache = function(req, res, next) {
	res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
	res.set('Pragma', 'no-cache');
	res.set('Expires', '0');
	next();
}
app.use(noCache);

if (config.autoShutdownTimeout) {
	var autoShutdownTimeout;
	var refreshAutoShutdownTimeout = function() {
		if (autoShutdownTimeout) clearTimeout(autoShutdownTimeout);
		autoShutdownTimeout = setTimeout(function() {
			winston.info('Shutting down ungit due to unactivity. (autoShutdownTimeout is set to ' + config.autoShutdownTimeout + 'ms)');
			process.exit(0);
		}, config.autoShutdownTimeout);
	}
	app.use(function(req, res, next) {
		refreshAutoShutdownTimeout();
		next();
	});
	refreshAutoShutdownTimeout();
}

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

app.get('/serverdata.js', function(req, res) {
	async.parallel({
		userHash: sysinfo.getUserHash.bind(sysinfo),
		version: sysinfo.getUngitVersion.bind(sysinfo)
	}, function(err, data) {
		var text = 'ungit.config = ' + JSON.stringify(config) + ';\n';
		text += 'ungit.userHash = "' + data.userHash + '";\n';
		text += 'ungit.version = "' + data.version + '";\n';
		res.send(text);
	});
});

app.get('/api/latestversion', function(req, res) {
	sysinfo.getUngitVersion(function(err, currentVersion) {
		sysinfo.getUngitLatestVersion(function(err, latestVersion) {
			if (err)
				res.json({ latestVersion: currentVersion, currentVersion: currentVersion, outdated: false });
			else if (!semver.valid(currentVersion))
				res.json({ latestVersion: latestVersion, currentVersion: currentVersion, outdated: false });
			else
				res.json({ latestVersion: latestVersion, currentVersion: currentVersion, outdated: semver.gt(latestVersion, currentVersion) });
		});
	});
});

app.get('/api/ping', function(req, res) {
	res.json({});
});

function getUserHome() {
	return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}
var userConfigPath = path.join(getUserHome(), '.ungitrc');
function readUserConfig(callback) {
	fs.exists(userConfigPath, function(hasConfig) {
		if (!hasConfig) return callback(null, {});

		fs.readFile(userConfigPath, { encoding: 'utf8' }, function(err, content) {
			if (err) return callback(err);
			else callback(null, JSON.parse(content.toString()));
		});
	});
}
function writeUserConfig(configContent, callback) {
	fs.writeFile(userConfigPath, JSON.stringify(configContent, undefined, 2), callback);
}

app.get('/api/userconfig', ensureAuthenticated, function(req, res) {
	readUserConfig(function(err, userConfig) {
		if (err) res.json(400, err);
		else res.json(userConfig);
	});
});
app.post('/api/userconfig', ensureAuthenticated, function(req, res) {
	writeUserConfig(req.body, function(err) {
		if (err) res.json(400, err);
		else res.json({});
	})
});

app.get('/api/fs/listDirectories', function(req, res) {
	var dir = req.query.term.trim();
	
	readUserConfig(function(err, userconfig) {
		if (err) res.json(400, err);
		else if (dir) {
			fs.readdir(dir, function(err, files) {
				if (err) {
					res.json(400, { errorCode: 'read-dir-failed', error: err });
				} else {
					var absolutePaths = files.map(function(file) {
						return path.join(dir, file);
					});
					async.filter(absolutePaths, function(absolutePath, callback) {
						fs.stat(absolutePath, function(err, stat) {
							callback(!err && stat && stat.isDirectory());
						});
					}, function(filteredFiles) {
						res.json(filteredFiles);
					});
				}
			});
		}
	});
});

// Error handling
app.use(function(err, req, res, next) {
	bugtracker.notify(err, 'ungit-node');
	usageStatistics.addEvent('server-exception');
	winston.error(err.stack);
	res.send(500, { error: err.message, errorType: err.name, stack: err.stack });
});

exports.started = new signals.Signal();

server.listen(config.port, function() {
	winston.info('Listening on port ' + config.port);
	console.log('## Ungit started ##'); // Consumed by bin/ungit to figure out when the app is started
	exports.started.dispatch();
});
