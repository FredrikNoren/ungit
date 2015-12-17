var child_process = require('child_process');
var gitParser = require('./git-parser');
var async = require('async');
var path = require('path');
var fs = require('fs');
var config = require('./config');
var winston = require('winston');
var inherits = require('util').inherits;
var addressParser = require('./address-parser');
var _ = require('lodash');
var isWindows = /^win/.test(process.platform);
var Promise = require('bluebird');
var gitConfigArguments = ['-c', 'color.ui=false', '-c', 'core.quotepath=false', '-c', 'core.pager=cat'];
var readFileProm = Promise.promisify(fs.readFile);
var fileAccessProm = Promise.promisify(fs.access);

var git = {};

git.getGitExecuteTask = function(args) {
  args.commands = gitConfigArguments.concat(args.commands).filter(function(element) {
    return element;
  });
  args.timeout = args.timeout || 2 * 60 * 1000; // Default timeout tasks after 2 min
  args.startTime = Date.now();

  var exec = new Promise(function (resolve, reject) {
    if (config.logGitCommands) winston.info('git executing: ' + args.repoPath + ' ' + args.commands.join(' '));
    var rejected = false;
    var stdout = '';
    var stderr = '';

    var gitProcess = child_process.spawn(
      'git',
      args.commands,
      {
        cwd: args.repoPath,
        maxBuffer: 1024 * 1024 * 100,
        timeout: args.timeout
      });
    var allowedCodes = args.allowedCodes || [0];

    if (args.outPipe) {
      gitProcess.stdout.pipe(args.outPipe);
    } else {
      gitProcess.stdout.on('data', function(data) {
        stdout += data.toString();
      });
    }
    gitProcess.stderr.on('data', function(data) {
      stderr += data.toString();
    });
    gitProcess.on('error', function (error) {
      if (args.outPipe) args.outPipe.end();
      rejected = true;
      reject(error);
    });

    gitProcess.on('close', function (code) {
      if (config.logGitCommands) winston.info('git result (first 400 bytes): ' + args.commands.join(' ') + '\n' + stderr.slice(0, 400) + '\n' + stdout.slice(0, 400));
      if (rejected) return;
      if (args.outPipe) args.outPipe.end();

      if (allowedCodes.indexOf(code) < 0) {
        reject(getGitError(args, stderr));
      } else {
        resolve(stdout);
      }
    });
  });

  if (args.parser) {
    exec.then(function(stdout) {
      // could put this in 'close' event but this will increase responsiveness of server
      return args.parser(stdout, args.parseArgs);
    });
  }

  return exec;
}
var getGitError = function(args, stderr) {
  var err = {};
  err.isGitError = true;
  err.errorCode = 'unknown';
  err.command = args.commands.join(' ');
  err.workingDirectory = args.repoPath;
  err.error = stderr.toString();
  err.message = err.error.split('\n')[0];
  err.stderr = stderr;
  if (stderr.indexOf('Not a git repository') >= 0)
    err.errorCode = 'not-a-repository';
  else if (err.stderr.indexOf('Connection timed out') != -1)
    err.errorCode = 'remote-timeout';
  else if (err.stderr.indexOf('Permission denied (publickey)') != -1)
    err.errorCode = 'permision-denied-publickey';
  else if (err.stderr.indexOf('ssh: connect to host') != -1 && err.stderr.indexOf('Bad file number') != -1)
    err.errorCode = 'ssh-bad-file-number';
  else if (err.stderr.indexOf('No remote configured to list refs from.') != -1)
    err.errorCode = 'no-remote-configured';
  else if ((err.stderr.indexOf('unable to access') != -1 && err.stderr.indexOf('Could not resolve host:') != -1) ||
    (err.stderr.indexOf('Could not resolve hostname') != -1))
    err.errorCode = 'offline';
  else if (err.stderr.indexOf('Proxy Authentication Required') != -1)
    err.errorCode = 'proxy-authentication-required';
  else if (err.stderr.indexOf('Please tell me who you are') != -1)
    err.errorCode = 'no-git-name-email-configured';
  else if (err.stderr.indexOf('FATAL ERROR: Disconnected: No supported authentication methods available (server sent: publickey)') == 0)
    err.errorCode = 'no-supported-authentication-provided';
  else if (stderr.indexOf('fatal: No remote repository specified.') == 0)
    err.errorCode = 'no-remote-specified';
  else if (err.stderr.indexOf('non-fast-forward') != -1)
    err.errorCode = 'non-fast-forward';
  else if (err.stderr.indexOf('Failed to merge in the changes.') == 0 || err.stdout.indexOf('CONFLICT (content): Merge conflict in') != -1 || err.stderr.indexOf('after resolving the conflicts') != -1)
    err.errorCode = 'merge-failed';
  else if (err.stderr.indexOf('This operation must be run in a work tree') != -1)
    err.errorCode = 'must-be-in-working-tree';
  else if (err.stderr.indexOf('Your local changes to the following files would be overwritten by checkout') != -1)
    err.errorCode = 'local-changes-would-be-overwritten';

  return err;
}

git.getCurrentBranch = function(repoPath) {
  var HEADFile;
  return this.getGitExecuteTask({ commands: ['rev-parse', '--show-toplevel'], repoPath: repoPath })
    .then(function(rootRepoPath) {
      HEADFile = path.join(rootRepoPath.trim(), '.git', 'HEAD');
    }).then(function() {
      return fileAccessProm(HEADFile, fs.R_OK).catch(function() {
        throw { errorCode: 'not-a-repository', error: 'No such file: ' + HEADFile }
      });
    }).then(function() {
      return readFileProm(HEADFile, 'utf8');
    }).then(function(text) {
      var rows = text.toString().split('\n');
      var branch = rows[0].slice('ref: refs/heads/'.length);
      return branch;
    });
}

module.exports = git;
