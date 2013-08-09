
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

var ssh2 = function(remote, command, callback) {
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
    host: remote.host,
    port: remote.port,
    username: remote.username
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

gerrit = function(remote, command, res, callback) {
  command = 'gerrit ' + command;
  ssh2(remote, command, function(error, result) {
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

module.exports = gerrit;