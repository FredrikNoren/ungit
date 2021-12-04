var startLaunchTime = Date.now();

var child_process = require('child_process');
var path = require('path');
// eslint-disable-next-line no-unused-vars -- Imported for side effects
const { encodePath } = require('../source/address-parser');
var config = require('../source/config');
var BugTracker = require('../source/bugtracker');
var bugtracker = new BugTracker('electron');

var { app, dialog, shell, BrowserWindow, Menu } = require('electron');

process.on('uncaughtException', function (err) {
  console.error(err.stack.toString());
  bugtracker.notify(err, 'ungit-launcher');
  app.quit();
});

function openUngitBrowser(pathToNavigateTo) {
  console.log(`Navigate to ${pathToNavigateTo}`);
  mainWindow.loadURL(pathToNavigateTo);
}

function launch(callback) {
  var url = config.urlBase + ':' + config.port;
  if (config.forcedLaunchPath === undefined) {
    url += '/#/repository?path=' + encodePath(process.cwd());
  } else if (config.forcedLaunchPath !== null && config.forcedLaunchPath !== '') {
    url += '/#/repository?path=' + encodePath(config.forcedLaunchPath);
  }

  if (config.launchCommand) {
    var command = config.launchCommand.replace(/%U/g, url);
    console.log('Running custom launch command: ' + command);
    child_process.exec(command, function (err, stdout, stderr) {
      if (err) {
        callback(err);
        return;
      }
      if (config.launchBrowser) {
        openUngitBrowser(url);
      }
    });
  } else if (config.launchBrowser) {
    openUngitBrowser(url);
  }
}

function checkIfUngitIsRunning(callback) {
  // Fastest way to find out if a port is used or not/i.e. if ungit is running
  var net = require('net');
  var server = net.createServer();
  server.on('error', function (e) {
    if (e.code == 'EADDRINUSE') {
      callback(true);
    }
  });
  server.listen({ port: config.port, host: config.ungitBindIp }, function () {
    server.close(function () {
      callback(false);
    });
  });
}

var mainWindow = null;

var appPath = app.getAppPath();
if (!appPath.endsWith('.asar')) {
  appPath = path.resolve(appPath, '..');
}

var menuTemplate = [
  {
    label: 'File',
    submenu: [{ role: 'quit' }],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'delete' },
      { type: 'separator' },
      { role: 'selectAll' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forcereload' },
      { role: 'toggledevtools' },
      { type: 'separator' },
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          await shell.openExternal('https://github.com/FredrikNoren/ungit');
        },
      },
    ],
  },
];

app.on('window-all-closed', function () {
  app.quit();
});

app.on('ready', function () {
  checkIfUngitIsRunning(function (ungitRunning) {
    if (ungitRunning) {
      dialog.showMessageBoxSync({
        type: 'error',
        title: 'Ungit',
        message: 'Ungit instance is already running',
      });
      app.quit();
    } else {
      var server = require('../source/server');
      server.started.add(function () {
        launch(function (err) {
          if (err) console.log(err);
        });

        var launchTime = Date.now() - startLaunchTime;
        console.log('Took ' + launchTime + 'ms to start server.');
      });

      Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

      mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        icon: path.join(appPath, 'public/images/icon.png'),
      });

      mainWindow.on('closed', function () {
        mainWindow = null;
      });
    }
  });
});
