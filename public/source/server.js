
var signals = require('signals');
var programEvents = require('ungit-program-events');
var _ = require('lodash');
var Promise = require("bluebird");
var rootPath = ungit.config && ungit.config.rootPath || '';

function Server() {
}
module.exports = Server;

Server.prototype.initSocket = function() {
  var self = this;
  this.socket = io.connect('', {
    path: rootPath + '/socket.io'
  });
  this.socket.on('error', function(err) {
    self._isConnected(function(connected) {
      if (connected) throw err;
      else self._onDisconnect();
    });
  });
  this.socket.on('disconnect', function() {
    self._onDisconnect();
  });
  this.socket.on('connected', function (data) {
    self.socketId = data.socketId;
    programEvents.dispatch({ event: 'connected' });
  });
  this.socket.on('working-tree-changed', function () {
    programEvents.dispatch({ event: 'working-tree-changed' });
  });
  this.socket.on('git-directory-changed', function () {
    programEvents.dispatch({ event: 'git-directory-changed' });
  });
  this.socket.on('request-credentials', function () {
    self._getCredentials(function(credentials) {
      self.socket.emit('credentials', credentials);
    });
  });
}
Server.prototype._queryToString = function(query) {
  var str = [];
  for(var p in query)
    if (query.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(query[p]));
    }
  return str.join("&");
}
Server.prototype._httpJsonRequest = function(request, callback) {
  var httpRequest = new XMLHttpRequest();
  httpRequest.onreadystatechange = function() {
    // It seems like you can get both readyState == 0, and readyState == 4 && status == 0 when you lose connection to the server
    if (httpRequest.readyState === 0) {
      callback({ error: 'connection-lost' });
    } else if (httpRequest.readyState === 4) {
      var body;
      try {
        body = JSON.parse(httpRequest.responseText);
      } catch(ex) { body = null; }
      if (httpRequest.status == 0) callback({ error: 'connection-lost' });
      else if (httpRequest.status != 200) callback({ status: httpRequest.status, body: body, httpRequest: httpRequest });
      else callback(null, body);
    }
  }
  var url = request.url;
  if (request.query) {
    url += '?' + this._queryToString(request.query);
  }
  httpRequest.open(request.method, url, true);
  httpRequest.setRequestHeader('Accept', 'application/json');
  if (request.body) {
    httpRequest.setRequestHeader('Content-Type', 'application/json');
    httpRequest.send(JSON.stringify(request.body));
  } else {
    httpRequest.send(null);
  }
}
// Check if the server is still alive
Server.prototype._isConnected = function(callback) {
  this._httpJsonRequest({ method: 'GET', url: rootPath + '/api/ping' }, function(err, res) {
    callback(!err && res);
  });
}
Server.prototype._onDisconnect = function() {
  programEvents.dispatch({ event: 'disconnected' });
}
Server.prototype._getCredentials = function(callback) {
  // Push out a program event, hoping someone will respond! (Which the app component will)
  programEvents.dispatch({ event: 'request-credentials' });
  var credentialsBinding = programEvents.add(function(event) {
    if (event.event != 'request-credentials-response') return;
    credentialsBinding.detach();
    callback({ username: event.username, password: event.password });
  });
}
Server.prototype.watchRepository = function(repositoryPath, callback) {
  this.socket.emit('watch', { path: repositoryPath }, callback);
};
Server.prototype.queryPromise = function(method, path, body) {
  var self = this;
  if (body) body.socketId = this.socketId;
  var request = {
    method: method,
    url: rootPath + '/api' + path,
  }
  if (method == 'GET' || method == 'DELETE') request.query = body;
  else request.body = body;

  return new Promise(function (resolve, reject) {
    self._httpJsonRequest(request, function(error, res) {
      if (error) {
        if (error.error == 'connection-lost') {
          return self._isConnected(function(connected) {
            if (connected) {
              reject({ errorCode: 'cross-domain-error', error: error });
            } else {
              self._onDisconnect();
              resolve();
            }
          });
        }
        var errorSummary = 'unknown';
        if (error.body) {
          if (error.body.errorCode && error.body.errorCode != 'unknown') errorSummary = error.body.errorCode;
          else if (typeof(error.body.error) == 'string') errorSummary = error.body.error.split('\n')[0];
          else if (typeof(error.body.message) == 'string') errorSummary = error.body.message;
          else errorSummary = JSON.stringify(error.body.error);
        } else {
          errorSummary = error.httpRequest.statusText + ' ' + error.status;
        }
        reject({
          errorSummary: errorSummary,
          error: error,
          path: path,
          res: error,
          errorCode: error && error.body ? error.body.errorCode : 'unknown'
        });
      } else {
        resolve(res);
      }
    });
  });
}
Server.prototype.getPromise = function(url, arg) {
  return this.queryPromise('GET', url, arg);
}
Server.prototype.postPromise = function(url, arg) {
  return this.queryPromise('POST', url, arg);
}
Server.prototype.delPromise = function(url, arg) {
  return this.queryPromise('DELETE', url, arg);
}
Server.prototype.emptyPromise = function() {
  return Promise.resolve();
}

Promise.onPossiblyUnhandledRejection(function(err, promise) {
  // Show a error screen for git errors (so that people have a chance to debug them)
  if (err.res && err.res.body && err.res.body.isGitError) {
    if (ungit.config && ungit.config.sendUsageStatistics) {
      keen.addEvent('git-error', { version: ungit.version, userHash: ungit.userHash });
    }
    console.log('git-error', err); // Used by the clicktests
    programEvents.dispatch({ event: 'git-error', data: {
      command: err.res.body.command,
      error: err.res.body.error,
      stdout: err.res.body.stdout,
      stderr: err.res.body.stderr,
      repoPath: err.res.body.workingDirectory
    } });
  } else {
    // Everything else is handled as a pure error, using the precreated error (to get a better stacktrace)
    console.error("Unhandled Promise ERROR: ", err, promise);
    programEvents.dispatch({ event: 'git-crash-error' });
    Raven.captureException(promise.reason());
  }
});
