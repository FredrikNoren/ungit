
var child_process = require('child_process');
var webpage = require('webpage');
var helpers = require('./helpers');
var Bluebird = require('bluebird');

module.exports = Environment;

// Environment provides
function Environment(page, config) {
  this.page = page;
  this.config = config || {};
  this.config.port = this.config.port || 8449;
  this.config.rootPath = (typeof this.config.rootPath === 'string') ? this.config.rootPath : '';
  this.config.serverTimeout = this.config.serverTimeout || 15000;
  this.config.viewportSize = this.config.viewportSize || { width: 2000, height: 2000 };
  this.config.showServerOutput = this.config.showServerOutput || false;
  this.config.serverStartupOptions = this.config.serverStartupOptions || [];
  this.url = 'http://localhost:' + this.config.port + this.config.rootPath;
}

Environment.prototype.init = function(callback) {
  var self = this;
  this.setupPage(this.page);
  this.startServer(function(err) {
    if (err) return callback(err);
    self.createTempFolder(function(err, res) {
      if (err) return callback(err);
      self.path = res.path;
      callback();
    });
  });
}
Environment.prototype.shutdown = function() {
  var self = this;
  this.page.onConsoleMessage = this.page.onResourceError = this.page.onError = undefined;
  return this.backgroundAction('POST', this.url + '/api/testing/cleanup')
    .then(function() {
      return self.shutdownServer(resolve);
    });
}
Environment.prototype.createCommits = function(config, limit, x) {
  var self = this;
  x = x || 0
  if (!limit || limit < 0 || x === limit) return Bluebird.resolve();
  return new Bluebird(function(resolve) {
    self.createTestFile(config.path + '/testy' + x, function() {
      self.backgroundAction('POST', self.url + '/api/commit', {
        path: config.path,
        message: 'Init Commit ' + x,
        files: [{ name: 'testy' + x }]
      }).then(resolve)
    });
  }).then(function() {
    return self.createCommits(config, limit, x + 1);
  });
}
Environment.prototype.createRepos = function(config, callback) {
  var self = this;
  return Bluebird.map(config, function(conf) {
    return new Bluebird(function(resolve) {
      self.createFolder(conf.path, function() {
        self.initFolder({ bare: !!conf.bare, path: conf.path }, function() {
          self.createCommits(conf, conf.initCommits).then(resolve);
        });
      });
    });
  }).then(function() { callback(); })
  .catch(callback);
}
Environment.prototype.setupPage = function() {
  var page = this.page;
  page.viewportSize = this.config.viewportSize;
  page.onConsoleMessage = function(msg, lineNum, sourceId) {
    console.log('[ui] ' + sourceId + ':' + lineNum + ' ' + msg);
    if (msg.indexOf('git-error') != -1) {
      console.log('git-error found, page rendered to error.png');
    }
  };
  page.onError = function(msg, trace) {
    console.log(msg);
    trace.forEach(function(t) {
      console.log(t.file + ':' + t.line + ' ' + t.function);
    });
    console.error('Caught error');
    phantom.exit(1);
  };
  page.onResourceError = function(resourceError) {
    helpers.log('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
    helpers.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
  };
  page.onResourceRequested = function(requestData, networkRequest) {
    helpers.log('Request (#' + requestData.id + '): ' + requestData.method + ' ' + requestData.url);
    // Abort gravatar requests to speed up things (since they will anyway only fail)
    if (requestData.url.indexOf('http://www.gravatar.com/avatar/') == 0) {
      networkRequest.abort();
    }
  };
  page.onResourceReceived = function(response) {
    if (response.stage == 'end')
      helpers.log('Response (#' + response.id + ', stage "' + response.stage + '")');
  };
  this.page = page;
}

Environment.prototype.startServer = function(callback) {
  var self = this;
  helpers.log('Starting ungit server...', this.config.serverStartupOptions);
  var hasStarted = false;
  var options = ['bin/ungit',
    '--cliconfigonly',
    '--port=' + this.config.port,
    '--rootPath=' + this.config.rootPath,
    '--no-launchBrowser',
    '--dev',
    '--no-bugtracking',
    '--no-sendUsageStatistics',
    '--autoShutdownTimeout=' + this.config.serverTimeout,
    '--maxNAutoRestartOnCrash=0',
    '--no-autoCheckoutOnBranchCreate',
    '--alwaysLoadActiveBranch',
    '--logGitCommands']
    .concat(this.config.serverStartupOptions);
  var ungitServer = child_process.spawn('node', options);
  ungitServer.stdout.on("data", function (data) {
    if (self.config.showServerOutput) console.log(prependLines('[server] ', data));

    if (data.toString().indexOf('Ungit server already running') >= 0) {
      callback('server-already-running');
    }

    if (data.toString().indexOf('## Ungit started ##') >= 0) {
      if (hasStarted) throw new Error('Ungit started twice, probably crashed.');
      hasStarted = true;
      helpers.log('Ungit server started.');
      callback();
    }
  });
  ungitServer.stderr.on("data", function (data) {
    console.log(prependLines('[server ERROR] ', data));
  });
  ungitServer.on('exit', function() {
    helpers.log('UNGIT SERVER EXITED');
  })
}

var getRestSetting = function(method, body) {
  return { operation: method, encoding: 'utf8', headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(body)};
}
Environment.prototype.backgroundAction = function(method, url, body) {
  var tempPage = webpage.create();
  return new Bluebird(function(resolve) {
    tempPage.open(url, getRestSetting(method, body), function(status) {
      if (status == 'fail') return resolve({ status: status, content: tempPage.plainText });
      tempPage.close();
      var data = tempPage.plainText;
      try { data = JSON.parse(data); } catch(ex) {}
      resolve(data);
    });
  });
}
Environment.prototype.createTestFile = function(filename, callback) {
  return this.backgroundAction('POST', this.url + '/api/testing/createfile', { file: filename })
    .then(callback.bind(null, null)).catch(callback)
}
Environment.prototype.changeTestFile = function(filename, callback) {
  return this.backgroundAction('POST', this.url + '/api/testing/changefile', { file: filename }, callback)
    .then(callback.bind(null, null)).catch(callback)
}
Environment.prototype.shutdownServer = function(callback) {
  return this.backgroundAction('POST', this.url + '/api/testing/shutdown');
}
Environment.prototype.createTempFolder = function(callback) {
  console.log('Creating temp folder');
  return this.backgroundAction('POST', this.url + '/api/testing/createtempdir', undefined, callback)
    .then(callback.bind(null, null)).catch(callback);
}
Environment.prototype.createFolder = function(dir, callback) {
  console.log('Create folder: ' + dir);
  return this.backgroundAction('POST', this.url + '/api/createdir', { dir: dir }, callback)
    .then(callback.bind(null, null)).catch(callback);
}
Environment.prototype.initFolder = function(options, callback) {
  return this.backgroundAction('POST', this.url + '/api/init', options, callback)
    .then(callback.bind(null, null)).catch(callback);
}
Environment.prototype.gitCommand = function(options, callback) {
  return this.backgroundAction('POST', this.url + '/api/testing/git', options, callback)
    .then(callback.bind(null, null)).catch(callback)
}

var prependLines = function(pre, text) {
  return text.split('\n').filter(function(l) { return l; }).map(function(line) { return pre + line; }).join('\n');
}
