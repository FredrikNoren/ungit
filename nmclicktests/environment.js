
var child_process = require('child_process');
var Bluebird = require('bluebird');
var Nightmare = require('nightmare');
var net = require('net');
var portrange = 45032;

module.exports = function(config) { return new Environment(config); }

// Environment provides
function Environment(config) {
  this.nightmare = Nightmare({ Promise: require('bluebird') });
  this.config = config || {};
  this.config.rootPath = (typeof this.config.rootPath === 'string') ? this.config.rootPath : '';
  this.config.serverTimeout = this.config.serverTimeout || 15000;
  this.config.viewWidth = 2000;
  this.config.viewHeight = 2000;
  this.config.showServerOutput = this.config.showServerOutput || true;
  this.config.serverStartupOptions = this.config.serverStartupOptions || [];
  this.shuttinDown = false;
}

Environment.prototype.getPort = function() {
  var self = this;
  portrange += 1;

  return new Bluebird(function(resolve, reject) {
    var server = net.createServer();

    server.listen(portrange, function (err) {
      server.once('close', function () {
        self.port = portrange;
        self.url = 'http://localhost:' + self.port + self.config.rootPath;
        resolve();
      });
      server.close();
    });
    server.on('error', function (err) {
      resolve(self.getPort());
    });
  });
}

Environment.prototype.log = function(text) {
  console.log((new Date()).toISOString(), text);
}

Environment.prototype.init = function() {
  var self = this;
  this.setupPage();
  return this.getPort()
    .then(function() { return self.startServer(); })
    .then(function() { return self.ensureStarted(); })
    .timeout(7000)
    .catch(function(err) { throw new Error("Cannot confirm ungit start!!"); })
    .then(function() { return self.createTempFolder(); })
    .then(function(res) { self.path = res.path });
}
Environment.prototype.shutdown = function(doNotClose) {
  var self = this;
  this.shuttinDown = true;
  return this.backgroundAction('POST', this.url + '/api/testing/cleanup')
    .then(function() { return self.shutdownServer(); })
    .then(function() { if (!doNotClose) self.nightmare.end(); });
}
Environment.prototype.createCommits = function(config, limit, x) {
  var self = this;
  x = x || 0
  if (!limit || limit < 0 || x === limit) return Bluebird.resolve();

  return self.createTestFile(config.path + '/testy' + x)
    .then(function() {
      return self.backgroundAction('POST', self.url + '/api/commit', {
        path: config.path,
        message: 'Init Commit ' + x,
        files: [{ name: 'testy' + x }]
      });
    }).then(function() { return self.createCommits(config, limit, x + 1); })
}
Environment.prototype.createRepos = function(config) {
  var self = this;
  return Bluebird.map(config, function(conf) {
    return self.createFolder(conf.path)
      .then(function() { return self.initFolder({ bare: !!conf.bare, path: conf.path }); })
      .then(function() { return self.createCommits(conf, conf.initCommits); })
  });
}
Environment.prototype.setupPage = function() {
  var self = this;
  this.nightmare.viewport(this.config.viewWidth, this.config.viewHeight);
  this.nightmare.on('console', function(type, msg) {
    self.log(`[ui] ${type} - ${msg}`);

    if (type === 'error' && !self.shuttinDown) {
      self.log('ERROR DETECTED!');
      process.exit(1);
    }
  });
}

Environment.prototype.ensureStarted = function() {
  var self = this;
  return Bluebird.resolve()
    .then(function() {
      if (!self.hasStarted) {
        return Bluebird.resolve()
          .delay(50)
          .then(function() { return self.ensureStarted(); });
      }
    });
}

Environment.prototype.goto = function(url) {
  this.nightmare = this.nightmare.goto(url);
  return this.nightmare;
}

Environment.prototype.startServer = function() {
  var self = this;
  this.log('Starting ungit server...', this.config.serverStartupOptions);

  self.hasStarted = false;
  var options = ['bin/ungit',
    '--cliconfigonly',
    '--port=' + self.port,
    '--rootPath=' + self.config.rootPath,
    '--no-launchBrowser',
    '--dev',
    '--no-bugtracking',
    '--no-sendUsageStatistics',
    '--autoShutdownTimeout=' + self.config.serverTimeout,
    '--logLevel=debug',
    '--maxNAutoRestartOnCrash=0',
    '--no-autoCheckoutOnBranchCreate',
    '--alwaysLoadActiveBranch',
    '--logGitCommands']
    .concat(self.config.serverStartupOptions);
  var ungitServer = child_process.spawn('node', options);
  ungitServer.stdout.on("data", function (data) {
    if (self.config.showServerOutput) self.log(prependLines('[server] ', data.toString()));

    if (data.toString().indexOf('Ungit server already running') >= 0) {
      self.log('server-already-running');
    }

    if (data.toString().indexOf('## Ungit started ##') >= 0) {
      if (self.hasStarted) {
        self.log('Ungit started twice, probably crashed.');
      } else {
        self.hasStarted = true;
        self.log('Ungit server started.');
      }
    }
  });
  ungitServer.stderr.on("data", function (data) {
    self.log(prependLines('[server ERROR] ', data.toString()));
    if (data.indexOf("EADDRINUSE") > -1) {
      self.log("retrying with different port");
      ungitServer.kill('SIGINT');
      self.getPort().then(function() { return self.startServer(); });
    }
  });
  ungitServer.on('exit', function() {
    self.log('UNGIT SERVER EXITED');
  });
  return Bluebird.resolve();
}

var getRestSetting = function(method) {
  return { method: method, encoding: 'utf8', 'cache-control': 'no-cache', 'Content-Type': 'application/json'};
}

var getUrlArgument = function(data) {
  return Object.keys(data).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(data[k])
    }).join('&')
}

Environment.prototype.backgroundAction = function(method, url, body) {
  if (method === 'GET') {
    url += getUrlArgument(body);
    body = null;
  } else {
    body = JSON.stringify(body);
  }

  return this.nightmare.goto(url, getRestSetting(method), body)
    .evaluate(function() { return document.querySelector('pre').innerHTML; })
    .then(function(data) {
      try { data = JSON.parse(data); } catch(ex) {}
      return data;
    });
}
Environment.prototype.createTestFile = function(filename) {
  return this.backgroundAction('POST', this.url + '/api/testing/createfile', { file: filename });
}
Environment.prototype.changeTestFile = function(filename) {
  return this.backgroundAction('POST', this.url + '/api/testing/changefile', { file: filename });
}
Environment.prototype.shutdownServer = function() {
  return this.backgroundAction('POST', this.url + '/api/testing/shutdown');
}
Environment.prototype.createTempFolder = function() {
  this.log('Creating temp folder');
  return this.backgroundAction('POST', this.url + '/api/testing/createtempdir');
}
Environment.prototype.createFolder = function(dir) {
  this.log('Create folder: ' + dir);
  return this.backgroundAction('POST', this.url + '/api/createdir', { dir: dir });
}
Environment.prototype.initFolder = function(options) {
  return this.backgroundAction('POST', this.url + '/api/init', options);
}
Environment.prototype.gitCommand = function(options) {
  return this.backgroundAction('POST', this.url + '/api/testing/git', options);
}

var prependLines = function(pre, text) {
  return text.split('\n').filter(function(l) { return l; }).map(function(line) { return pre + line; }).join('\n');
}
