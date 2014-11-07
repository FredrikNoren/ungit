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
var os = require('os');
var cache = require('./utils/cache');
var UngitPlugin = require('./ungit-plugin');
var serveStatic = require('serve-static');
var bodyParser = require('body-parser');

process.on('uncaughtException', function(err) {
  winston.error(err.stack ? err.stack.toString() : err.toString());
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
    done(null, users[username] !== undefined ? username : null);
  });

  passport.use(new LocalStrategy(function(username, password, done) {
    if (users[username] !== undefined && password === users[username])
      done(null, username);
    else
      done(null, false, { message: 'No such username/password' });
  }));
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

if (config.allowedIPs) {
  app.use(function(req, res, next) {
    var ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
    if (config.allowedIPs.indexOf(ip) >= 0) next();
    else res.status(403).send(403, '<h3>This host is not authorized to connect</h3>' +
      '<p>You are trying to connect to an Ungit instance from an unathorized host.</p>');
  });
}

var noCache = function(req, res, next) {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}
app.use(noCache);

app.use(require('body-parser').json());

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
  var cookieParser = require('cookie-parser');
  app.use(cookieParser());
  var session = require('express-session');
  app.use(session({ secret: 'ungit' }));
  app.use(passport.initialize());
  app.use(passport.session());

  app.post('/api/login', function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
      if (err) { return next(err) }
      if (!user) {
        res.status(401).json({ errorCode: 'authentication-failed', error: info.message });
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
    res.status(401).json({ errorCode: 'authentication-required', error: 'You have to authenticate to access this resource' });
  };
}

var indexHtmlCache = cache(function(callback) {
  pluginsCache(function(plugins) {
    fs.readFile(__dirname + '/../public/index.html', function(err, data) {
      async.map(Object.keys(plugins), function(pluginName, callback) {
        plugins[pluginName].compile(callback);
      }, function(err, result) {
        var html = result.join('\n\n');
        data = data.toString().replace('<!-- ungit-plugins-placeholder -->', html);
        callback(null, data);
      });
    });
  });
});

app.get('/', function(req, res) {
  if (config.dev) {
    pluginsCache.invalidate();
    indexHtmlCache.invalidate();
  }
  indexHtmlCache(function(err, data) {
    res.end(data);
  });
});

app.use(serveStatic(__dirname + '/../public'));

// Socket-IO
var socketIO = require('socket.io');
var socketsById = {};
var socketIdCounter = 0;
var io = socketIO.listen(server, {
  logger: {
    debug: winston.debug.bind(winston),
    info: winston.info.bind(winston),
    error: winston.error.bind(winston),
    warn: winston.warn.bind(winston)
  }
});
io.sockets.on('connection', function (socket) {
  var socketId = socketIdCounter++;
  socketsById[socketId] = socket;
  socket.socketId = socketId;
  socket.emit('connected', { socketId: socketId });
  socket.on('disconnect', function () {
    delete socketsById[socketId];
  });
});

var apiEnvironment = {
  app: app,
  server: server,
  ensureAuthenticated: ensureAuthenticated,
  git: require('./git'),
  config: config,
  pathPrefix: gitApi.pathPrefix,
  socketIO: io,
  socketsById: socketsById
};

gitApi.registerApi(apiEnvironment);

// Init plugins
function loadPlugins(plugins, pluginBasePath) {
  fs.readdirSync(pluginBasePath).forEach(function(pluginDir) {
    var pluginPath = path.join(pluginBasePath, pluginDir);
    // if not a directory or doesn't contain an ungit-plugin.json, just skip it.
    if (!fs.lstatSync(pluginPath).isDirectory() ||
      !fs.existsSync(path.join(pluginPath, 'ungit-plugin.json'))) {
      return;
    }
    winston.info('Loading plugin: ' + pluginPath);
    var plugin = new UngitPlugin({
      dir: pluginDir,
      httpBasePath: 'plugins/' + pluginDir,
      path: pluginPath
    });
    if (plugin.manifest.disabled || plugin.config.disabled) {
      winston.info('Plugin disabled: ' + pluginDir);
      return;
    }
    plugin.init(apiEnvironment);
    plugins.push(plugin);
    winston.info('Plugin loaded: ' + pluginDir);
  });
}
var pluginsCache = cache(function(callback) {
  var plugins = [];
  loadPlugins(plugins, path.join(__dirname, '..', 'components'));
  if (fs.existsSync(config.pluginDirectory))
    loadPlugins(plugins, config.pluginDirectory);
  callback(plugins);
});

app.get('/serverdata.js', function(req, res) {
  async.parallel({
    userHash: sysinfo.getUserHash.bind(sysinfo),
    version: sysinfo.getUngitVersion.bind(sysinfo)
  }, function(err, data) {
    var text = 'ungit.config = ' + JSON.stringify(config) + ';\n';
    text += 'ungit.userHash = "' + data.userHash + '";\n';
    text += 'ungit.version = "' + data.version + '";\n';
    text += 'ungit.platform = "' + os.platform() + '"\n';
    text += 'ungit.pluginApiVersion = "' + require('../package.json').ungitPluginApiVersion + '"\n';
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

app.get('/api/gitversion', function(req, res) {
  sysinfo.getGitVersionInfo(function(result) {
    res.json(result);
  });
});

function getUserHome() {
  return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE || "/tmp";
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
    if (err) res.status(400).json(err);
    else res.json(userConfig);
  });
});
app.post('/api/userconfig', ensureAuthenticated, function(req, res) {
  writeUserConfig(req.body, function(err) {
    if (err) res.status(400).json(err);
    else res.json({});
  })
});


app.get('/api/fs/exists', ensureAuthenticated, function(req, res) {
  res.json(fs.existsSync(req.param('path')));
});

app.get('/api/fs/listDirectories', ensureAuthenticated, function(req, res) {
  var dir = req.query.term.trim();

  readUserConfig(function(err, userconfig) {
    if (err) res.status(400).json(err);
    else if (dir) {
      fs.readdir(dir, function(err, files) {
        if (err) {
          res.status(400).json({ errorCode: 'read-dir-failed', error: err });
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
  res.status(500).send({ error: err.message, errorType: err.name, stack: err.stack });
});

exports.started = new signals.Signal();

server.listen(config.port, function() {
  winston.info('Listening on port ' + config.port);
  console.log('## Ungit started ##'); // Consumed by bin/ungit to figure out when the app is started
  exports.started.dispatch();
});
