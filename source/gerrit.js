
var Ssh2Connection = require('ssh2');
var git = require('./git');
var config = require('./config')();
var os = require('os');
var child_process = require('child_process');
var _ = require('underscore');

var getProcessUsername = function(callback) {
  child_process.exec('whoami', function(err, res) {
    if (err) callback(err);
    else {
      res = res.split('\n')[0];
      if (res.indexOf('/') != -1) res = _.last(res.split('/'));
      res = res.trim();
      callback(null, res);
    }
  });
};

var ssh2 = function(username, host, port, command, callback) {
  var connection = new Ssh2Connection();
  connection.on('connect', function() {
  });
  connection.on('ready', function() {
    connection.exec(command, function(err, stream) {
      if (err) return callback(err);
      var result = '';
      stream.on('data', function(data, extended) {
        result += data.toString();
      });
      stream.on('end', function() {
        callback(null, result);
      });
    });
  });
  connection.on('error', function(err) {
    callback(err);
  });
  var connectConfig = {
    host: host,
    port: port,
    username: username
  };
  connectConfig.agent = config.sshAgent;
  if (!connectConfig.agent) {
    if (os.type() == 'Windows_NT') connectConfig.agent = 'pageant';
    else connectConfig.agent = '' + process.env.SSH_AUTH_SOCK;
  }
  if (config.sshUsername)
    connectConfig.username = config.sshUsername;
  var doConnect = function() { connection.connect(connectConfig); };
  if (connectConfig.username) doConnect();
  else getProcessUsername(function(err, username) {
    if (err) callback(err);
    else {
      connectConfig.username = username;
      doConnect();
    }
  });
};

gerrit = function(username, host, port, command, res, callback) {
  command = 'gerrit ' + command;
  ssh2(username, host, port, command, function(error, result) {
    if (error) {
      var err = { errorCode: 'unkown', command: command, error: error.toString() };
      if (!callback || !callback(err, result)) {
        res.json(400, err);
      }
    } else {
      callback(null, result);
    }
  });
};

var gerriAddresstSshWithPortRegexp = /ssh:\/\/(.*):(\d*)\/(.*)/;
var gerritAddressSshWithoutPortRegexp = /ssh:\/\/([^\/]*)\/(.*)/;
var gerritAddressGitWithoutPortWithUsernamePortRegexp = /([^@]*)@([^:]*):(.*).git/;
var gerritAddressGitWithoutPortWithoutUsernameRegexp = /([^:]*):(.*).git/;

gerrit.parseRemote = function(remote) {
  var match = gerriAddresstSshWithPortRegexp.exec(remote);
  if (match) return { host: match[1], port: match[2], project: match[3] };
  
  match = gerritAddressSshWithoutPortRegexp.exec(remote);
  if (match) return { host: match[1], project: match[2] };
  
  match = gerritAddressGitWithoutPortWithUsernamePortRegexp.exec(remote);
  if (match) return { username: match[1], host: match[2], project: match[3] };

  match = gerritAddressGitWithoutPortWithoutUsernameRegexp.exec(remote);
  if (match) return { host: match[1], project: match[2] };
}

gerrit.getGerritAddress = function(repoPath, res, callback) {
  git.remoteShow(repoPath, 'origin', res, function(err, remote) {
    if (err) return res.json(400, err);
    var r = gerrit.parseRemote(remote.fetch);
    if (r) {
      callback(r.username, r.host, r.port, r.project);
    } else {
      res.json(400, { error: 'Unsupported gerrit remote: ' + remote.fetch, details: 'getGerritAddress' });
    }
  });
}

module.exports = gerrit;