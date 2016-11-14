
var child_process = require('child_process');
var webpage = require('webpage');
var async = require('async');
var helpers = require('./helpers');

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
Environment.prototype.shutdown = function(callback, doNotClose) {
  var self = this;
  this.page.onConsoleMessage = this.page.onResourceError = this.page.onError = undefined;
  this.backgroundAction('POST', this.url + '/api/testing/cleanup', undefined, function() {
    self.shutdownServer(function() {
      callback();
      if (!doNotClose) self.page.close();
    });
  });
}
Environment.prototype.createRepos = function(config, callback) {
  var self = this;
  async.mapSeries(config, function(conf, callback) {
    self.createFolder(conf.path, function() {
      self.initFolder({ bare: !!conf.bare, path: conf.path }, function() {
        if (conf.initCommits) {
          async.timesSeries(conf.initCommits, function(x, callback) {
            self.createTestFile(conf.path + '/testy' + x, function() {
              self.backgroundAction('POST', self.url + '/api/commit', {
                path: conf.path,
                message: 'Init Commit ' + x,
                files: [{ name: 'testy' + x }]
              }, callback);
            });
          }, callback);
        } else {
          callback();
        }
      });
    });
  }, callback);
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
Environment.prototype.backgroundAction = function(method, url, body, callback) {
  var tempPage = webpage.create();
  tempPage.open(url, getRestSetting(method, body), function(status) {
    if (status == 'fail') return callback({ status: status, content: tempPage.plainText });
    tempPage.close();
    var data = tempPage.plainText;
    try { data = JSON.parse(data); } catch(ex) {}
    callback(null, data);
  });
}
Environment.prototype.createTestFile = function(filename, callback) {
  this.backgroundAction('POST', this.url + '/api/testing/createfile', { file: filename }, callback);
}
Environment.prototype.changeTestFile = function(filename, callback) {
  this.backgroundAction('POST', this.url + '/api/testing/changefile', { file: filename }, callback);
}
Environment.prototype.shutdownServer = function(callback) {
  this.backgroundAction('POST', this.url + '/api/testing/shutdown', undefined, callback);
}
Environment.prototype.createTempFolder = function(callback) {
  console.log('Creating temp folder');
  this.backgroundAction('POST', this.url + '/api/testing/createtempdir', undefined, callback);
}
Environment.prototype.createFolder = function(dir, callback) {
  console.log('Create folder: ' + dir);
  this.backgroundAction('POST', this.url + '/api/createdir', { dir: dir }, callback);
}
Environment.prototype.initFolder = function(options, callback) {
  this.backgroundAction('POST', this.url + '/api/init', options, callback);
}
Environment.prototype.gitCommand = function(options, callback) {
  console.log(">>>>", JSON.stringify(options));
  this.backgroundAction('POST', this.url + '/api/testing/git', options, callback);
}

var prependLines = function(pre, text) {
  return text.split('\n').filter(function(l) { return l; }).map(function(line) { return pre + line; }).join('\n');
}
