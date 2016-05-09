var startLaunchTime = Date.now();
var config = require('../src/config');
var open = require('open');
var path = require('path');
var child_process = require('child_process');
var async = require('async');

var BugTracker = require('../src/bugtracker');
var bugtracker = new BugTracker('launcher');
var usageStatistics = require('../src/usage-statistics');

var app = require('app');  // Module to control application life.
var BrowserWindow = require('browser-window');  // Module to create native browser window.

process.on('uncaughtException', function(err) {
  console.error(err.stack.toString());
  async.parallel([
    bugtracker.notify.bind(bugtracker, err, 'ungit-launcher'),
    usageStatistics.addEvent.bind(usageStatistics, 'launcher-exception')
  ], function() {
    app.quit();
  });
});

function launch(callback) {
  var currentUrl = config.urlBase + ':' + config.port;
  if (config.forcedLaunchPath === undefined) currentUrl += '/#/repository?path=' + encodeURIComponent(process.cwd());
  else if (config.forcedLaunchPath !== null && config.forcedLaunchPath !== '') currentUrl += '/#/repository?path=' + encodeURIComponent(config.forcedLaunchPath);
  console.log('Browse to ' + currentUrl);
  if (config.launchBrowser && !config.launchCommand) {
    mainWindow.loadUrl(currentUrl);
  } else if (config.launchCommand) {
    var command = config.launchCommand.replace(/%U/g, currentUrl);
    console.log('Running custom launch command: ' + command);
    child_process.exec(command, function(err, stdout, stderr) {
      if (err) {
        callback(err);
        return;
      }
      if (config.launchBrowser)
        mainWindow.loadUrl(currentUrl);
    });
  }
}

function checkIfUngitIsRunning(callback) {
  // Fastest way to find out if a port is used or not/i.e. if ungit is running
  var net = require('net');
  var server = net.createServer(function(c) { });
  server.listen(config.port, function(err) {
    server.close(function() {
      callback(null, false);
    });
  });
  server.on('error', function (e) {
    if (e.code == 'EADDRINUSE') {
      callback(null, true);
    }
  });
}

var mainWindow = null;

app.on('window-all-closed', function() {
    app.quit();
});

app.on('ready', function() {
  checkIfUngitIsRunning(function(err1, ungitRunning) {
    if (ungitRunning) {
      console.log('Ungit instance is already running');
      app.quit();
    }
    else {
      var server = require('../src/server');
      server.started.add(function() {
        launch(function(err) {
          if (err) console.log(err);
        })

        var launchTime = (Date.now() - startLaunchTime);
        console.log('Took ' + launchTime + 'ms to start server.');
        usageStatistics.addEvent('server-start', { launchTimeMs: launchTime });
      });

      mainWindow = new BrowserWindow({width: 1366, height: 768});

      mainWindow.on('closed', function() {
        mainWindow = null;
      });
    }
  });
});
