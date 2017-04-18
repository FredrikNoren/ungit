
var child_process = require('child_process');
var helpers = require('./helpers');
var Bluebird = require('bluebird');
var Nightmare = require('nightmare');

module.exports = Environment;

// Environment provides
function Environment(nightmare, config) {
  this.nm = Nightmare({ Promise: require('bluebird') });
  this.port = helpers.getPort();
  this.config = config || {};
  this.config.rootPath = (typeof this.config.rootPath === 'string') ? this.config.rootPath : '';
  this.config.serverTimeout = this.config.serverTimeout || 15000;
  this.config.viewWidth = 2000;
  this.config.viewHeight = 2000;
  this.config.showServerOutput = this.config.showServerOutput || true;
  this.config.serverStartupOptions = this.config.serverStartupOptions || [];
  this.url = 'http://localhost:' + this.port + this.config.rootPath;
}

Environment.prototype.log = function(text) {
  console.log((new Date()).toISOString(), text);
}

Environment.prototype.init = function() {
  var self = this;
  this.setupPage();
  return this.startServer()
    .then(function() { return self.ensureStarted(); })
    .timeout(7000)
    .catch(function(err) { throw new Error("Cannot confirm ungit start!!")})
    .then(function() { return self.createTempFolder(); })
    .then(function(res) { self.path = res.path });
}
Environment.prototype.shutdown = function(doNotClose) {
  var self = this;
  return this.backgroundAction('POST', this.url + '/api/testing/cleanup')
    .then(function() { return self.shutdownServer(); })
    .end()
    .then(function() { if (!doNotClose) self.nm.end(); });
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
  this.nightmare.on('console', function(type) {
    self.log('[ui] ' + arguments);

    if (type === 'error') {
      self.log('ERROR DETECTED!');
      process.exit(1);
    }
  });


  // page.onConsoleMessage = function(msg, lineNum, sourceId) {
  //   this.log('[ui] ' + sourceId + ':' + lineNum + ' ' + msg);
  //   if (msg.indexOf('git-error') != -1) {
  //     this.log('git-error found, page rendered to error.png');
  //   }
  // };
  // page.onError = function(msg, trace) {
  //   this.log(msg);
  //   trace.forEach(function(t) {
  //     this.log(t.file + ':' + t.line + ' ' + t.function);
  //   });
  //   phantom.exit(1);
  // };
  // page.onResourceError = function(resourceError) {
  //   this.log('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
  //   this.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
  // };
  // page.onResourceRequested = function(requestData, networkRequest) {
  //   var requestUrl =  requestData.url.indexOf("data:application/font-woff") > -1 ? "[omitted font file...]" : requestData.url;
  //   this.log('Request (#' + requestData.id + '): ' + requestData.method + ' ' + requestUrl);
  //   // Abort gravatar requests to speed up things (since they will anyway only fail)
  //   if (requestData.url.indexOf('http://www.gravatar.com/avatar/') == 0) {
  //     networkRequest.abort();
  //   }
  // };
  // page.onResourceReceived = function(response) {
  //   if (response.stage == 'end')
  //     this.log('Response (#' + response.id + ', stage "' + response.stage + '")');
  // };
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
    if (self.config.showServerOutput) this.log(prependLines('[server] ', data));

    if (data.toString().indexOf('Ungit server already running') >= 0) {
      this.log('server-already-running');
    }

    if (data.toString().indexOf('## Ungit started ##') >= 0) {
      if (self.hasStarted) {
        this.log('Ungit started twice, probably crashed.');
      } else {
        self.hasStarted = true;
        this.log('Ungit server started.');
      }
    }
  });
  ungitServer.stderr.on("data", function (data) {
    this.log(prependLines('[server ERROR] ', data));
    if (data.indexOf("EADDRINUSE") > -1) {
      this.log("retrying with different port");
      ungitServer.kill('SIGINT');
      self.port = helpers.getPort();
      self.url = 'http://localhost:' + self.port + self.config.rootPath;
      self.startServer();
    }
  });
  ungitServer.on('exit', function() {
    this.log('UNGIT SERVER EXITED');
  });
  return Bluebird.resolve();
}

var getRestSetting = function(method, body) {
  return { operation: method, encoding: 'utf8', headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(body)};
}
Environment.prototype.backgroundAction = function(method, url, body) {
  return nightmare.goto(url, { method: getRestSetting(method, body) })
    .evaluate(function() { return document.querySelector('pre').innerHTML; })
    .end()
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
