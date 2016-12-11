const config = require('./config');
const BugTracker = require('./bugtracker');
const bugtracker = new BugTracker('server');
const usageStatistics = require('./usage-statistics');
const express = require('express');
const gitApi = require('./git-api');
const winston = require('winston');
const sysinfo = require('./sysinfo');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const semver = require('semver');
const path = require('path');
const fs = require('fs');
const async = require('async');
const signals = require('signals');
const os = require('os');
const cache = require('./utils/cache');
const UngitPlugin = require('./ungit-plugin');
const serveStatic = require('serve-static');
const bodyParser = require('body-parser');

process.on('uncaughtException', (err) => {
  winston.error(err.stack ? err.stack.toString() : err.toString());
  async.parallel([
    bugtracker.notify.bind(bugtracker, err, 'ungit-server'),
    usageStatistics.addEvent.bind(usageStatistics, 'server-exception')
  ], () => process.exit());
});

console.log('Setting log level to ' + config.logLevel);
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  level: config.logLevel,
  timestamp: true,
  colorize: true
});
if (config.logDirectory)
  winston.add(winston.transports.File, { filename: path.join(config.logDirectory, 'server.log'), maxsize: 100*1024, maxFiles: 2 });

const users = config.users;
config.users = null; // So that we don't send the users to the client

if (config.authentication) {

  passport.serializeUser((username, done) => {
    done(null, username);
  });

  passport.deserializeUser((username, done) => {
    done(null, users[username] !== undefined ? username : null);
  });

  passport.use(new LocalStrategy((username, password, done) => {
    if (users[username] !== undefined && password === users[username])
      done(null, username);
    else
      done(null, false, { message: 'No such username/password' });
  }));
}

const app = express();
const server = require('http').createServer(app);

gitApi.pathPrefix = '/api';

app.use((req, res, next) => {
  const rootPath = config.rootPath;
  if (req.url === rootPath) {
    // always have a trailing slash
    res.redirect(req.url + '/');
    return;
  }
  if (req.url.indexOf(rootPath) === 0) {
    req.url = req.url.substring(rootPath.length);
    next();
    return;
  }
  res.send(400).end();
});

if (config.logRESTRequests) {
  app.use((req, res, next) => {
    winston.info(req.method + ' ' + req.url);
    next();
  });
}

if (config.allowedIPs) {
  app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
    if (config.allowedIPs.indexOf(ip) >= 0) next();
    else res.status(403).send(403, '<h3>This host is not authorized to connect</h3>' +
      '<p>You are trying to connect to an Ungit instance from an unathorized host.</p>');
  });
}

const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}
app.use(noCache);

app.use(require('body-parser').json());

if (config.autoShutdownTimeout) {
  let autoShutdownTimeout;
  const refreshAutoShutdownTimeout = () => {
    if (autoShutdownTimeout) clearTimeout(autoShutdownTimeout);
    autoShutdownTimeout = setTimeout(() => {
      winston.info('Shutting down ungit due to unactivity. (autoShutdownTimeout is set to ' + config.autoShutdownTimeout + 'ms)');
      process.exit(0);
    }, config.autoShutdownTimeout);
  }
  app.use((req, res, next) => {
    refreshAutoShutdownTimeout();
    next();
  });
  refreshAutoShutdownTimeout();
}

let ensureAuthenticated = (req, res, next) => { next(); };

if (config.authentication) {
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());
  const session = require('express-session');
  app.use(session({ secret: 'ungit' }));
  app.use(passport.initialize());
  app.use(passport.session());

  app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) { return next(err) }
      if (!user) {
        res.status(401).json({ errorCode: 'authentication-failed', error: info.message });
        return;
      }
      req.logIn(user, (err) => {
        if (err) { return next(err); }
        res.json({ ok: true });
        return;
      });
    })(req, res, next);
  });

  app.get('/api/loggedin', (req, res) => {
    if (req.isAuthenticated()) res.json({ loggedIn: true });
    else res.json({ loggedIn: false });
  });

  app.get('/api/logout', (req, res) => {
    req.logout();
    res.json({ ok: true });
  });

  ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) { return next(); }
    res.status(401).json({ errorCode: 'authentication-required', error: 'You have to authenticate to access this resource' });
  };
}

const indexHtmlCache = cache((callback) => {
  pluginsCache((plugins) => {
    fs.readFile(__dirname + '/../public/index.html', (err, data) => {
      async.map(Object.keys(plugins), (pluginName, callback) => {
        plugins[pluginName].compile(callback);
      }, (err, result) => {
        const html = result.join('\n\n');
        data = data.toString().replace('<!-- ungit-plugins-placeholder -->', html);
        data = data.replace(/__ROOT_PATH__/g, config.rootPath);
        callback(null, data);
      });
    });
  });
});

app.get('/', (req, res) => {
  if (config.dev) {
    pluginsCache.invalidate();
    indexHtmlCache.invalidate();
  }
  indexHtmlCache((err, data) => {
    res.end(data);
  });
});

app.use(serveStatic(__dirname + '/../public'));

// Socket-IO
const socketIO = require('socket.io');
const socketsById = {};
let socketIdCounter = 0;
const io = socketIO.listen(server, {
  path: config.rootPath + '/socket.io',
  logger: {
    debug: winston.debug.bind(winston),
    info: winston.info.bind(winston),
    error: winston.error.bind(winston),
    warn: winston.warn.bind(winston)
  }
});
io.sockets.on('connection', (socket) => {
  const socketId = socketIdCounter++;
  socketsById[socketId] = socket;
  socket.socketId = socketId;
  socket.emit('connected', { socketId: socketId });
  socket.on('disconnect', () => delete socketsById[socketId]);
});

const apiEnvironment = {
  app: app,
  server: server,
  ensureAuthenticated: ensureAuthenticated,
  config: config,
  pathPrefix: gitApi.pathPrefix,
  socketIO: io,
  socketsById: socketsById
};

gitApi.registerApi(apiEnvironment);

// Init plugins
const loadPlugins = (plugins, pluginBasePath) => {
  fs.readdirSync(pluginBasePath).forEach((pluginDir) => {
    const pluginPath = path.join(pluginBasePath, pluginDir);
    // if not a directory or doesn't contain an ungit-plugin.json, just skip it.
    if (!fs.lstatSync(pluginPath).isDirectory() ||
      !fs.existsSync(path.join(pluginPath, 'ungit-plugin.json'))) {
      return;
    }
    winston.info('Loading plugin: ' + pluginPath);
    const plugin = new UngitPlugin({
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
const pluginsCache = cache((callback) => {
  const plugins = [];
  loadPlugins(plugins, path.join(__dirname, '..', 'components'));
  if (fs.existsSync(config.pluginDirectory))
    loadPlugins(plugins, config.pluginDirectory);
  callback(plugins);
});

app.get('/serverdata.js', (req, res) => {
  sysinfo.getUserHash()
    .then((hash) => {
      const text = `ungit.config = ${JSON.stringify(config)};\n` +
        `ungit.userHash = "${hash}";\n` +
        `ungit.version = "${config.ungitDevVersion}";\n` +
        `ungit.platform = "${os.platform()}"\n` +
        `ungit.pluginApiVersion = "${require('../package.json').ungitPluginApiVersion}"\n`;
      res.send(text);
    });
});

app.get('/api/latestversion', (req, res) => {
  sysinfo.getUngitLatestVersion()
    .then((latestVersion) => {
      if (!semver.valid(config.ungitDevVersion)) {
        res.json({
          latestVersion: latestVersion,
          currentVersion: config.ungitDevVersion,
          outdated: false
        });
      } else {
        // We only want to show the "new version" banner if the major/minor version was bumped
        let latestSansPatch = semver(latestVersion);
        latestSansPatch.patch = 0;
        let currentSansPatch = semver(config.ungitDevVersion);
        currentSansPatch.patch = 0;
        res.json({
          latestVersion: latestVersion,
          currentVersion: config.ungitDevVersion,
          outdated: semver.gt(latestSansPatch, currentSansPatch)
        });
      }
    }).catch((err) => {
      res.json({ latestVersion: config.ungitDevVersion, currentVersion: config.ungitDevVersion, outdated: false });
    });
});

app.get('/api/ping', (req, res) => res.json({}));

app.get('/api/gitversion', (req, res) => {
  sysinfo.getGitVersionInfo().then((result) => res.json(result));
});

const userConfigPath = path.join(config.homedir, '.ungitrc');
const readUserConfig = (callback) => {
  fs.exists(userConfigPath, (hasConfig) => {
    if (!hasConfig) return callback(null, {});

    fs.readFile(userConfigPath, { encoding: 'utf8' }, (err, content) => {
      if (err) return callback(err);
      else callback(null, JSON.parse(content.toString()));
    });
  });
}
const writeUserConfig = (configContent, callback) => {
  fs.writeFile(userConfigPath, JSON.stringify(configContent, undefined, 2), callback);
}

app.get('/api/userconfig', ensureAuthenticated, (req, res) => {
  readUserConfig((err, userConfig) => {
    if (err) res.status(400).json(err);
    else res.json(userConfig);
  });
});
app.post('/api/userconfig', ensureAuthenticated, (req, res) => {
  writeUserConfig(req.body, (err) => {
    if (err) res.status(400).json(err);
    else res.json({});
  })
});


app.get('/api/fs/exists', ensureAuthenticated, (req, res) => {
  res.json(fs.existsSync(req.query['path']));
});

app.get('/api/fs/listDirectories', ensureAuthenticated, (req, res) => {
  const dir = req.query.term.trim();

  readUserConfig((err, userconfig) => {
    if (err) res.status(400).json(err);
    else if (dir) {
      fs.readdir(dir, (err, files) => {
        if (err) {
          res.status(400).json({ errorCode: 'read-dir-failed', error: err });
        } else {
          const absolutePaths = files.map((file) => { return path.join(dir, file) });
          async.filter(absolutePaths, (absolutePath, callback) => {
            fs.stat(absolutePath, (err, stat) => {
              callback(null, !err && stat && stat.isDirectory());
            });
          }, (err, filteredFiles) => res.json(filteredFiles));
        }
      });
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  bugtracker.notify(err, 'ungit-node');
  usageStatistics.addEvent('server-exception');
  winston.error(err.stack);
  res.status(500).send({ error: err.message, errorType: err.name, stack: err.stack });
});

exports.started = new signals.Signal();

server.listen(config.port, () => {
  winston.info('Listening on port ' + config.port);
  console.log('## Ungit started ##'); // Consumed by bin/ungit to figure out when the app is started
  exports.started.dispatch();
});
