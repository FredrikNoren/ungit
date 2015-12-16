var child_process = require('child_process');
var gitParser = require('./git-parser');
var async = require('async');
var path = require('path');
var fs = require('fs');
var config = require('./config');
var winston = require('winston');
var inherits = require('util').inherits;
var addressParser = require('./address-parser');
var GitTask = require('./git-task');
var _ = require('lodash');
var isWindows = /^win/.test(process.platform);
var Promise = require('bluebird');
var gitConfigArguments = ['-c', 'color.ui=false', '-c', 'core.quotepath=false', '-c', 'core.pager=cat'];
var readFile = Promise.promisify(fs.readFile);

var git = {};

git.getGitExecutionTask = function(commands, repoPath, allowedCodes, outPipe) {
  var self = this;
  commands = gitConfigArguments.concat(commands).filter(function(element) {
    return element;
  });
  this.repoPath = repoPath;
  this.commands = commands;
  this._timeout = 2 * 60 * 1000; // Default timeout tasks after 2 min
  // TODO: remove this fake stack trace and use promise erro handling
  this.potentialError = new Error(); // caputers the stack trace here so that we can use it if the command fail later on
  this.potentialError.commmands = commands;
  this.allowedCodes = allowedCodes;
  this.outPipe = outPipe;
  this.promise = null;

  this.start = function() {
    self.promise = new Promise(function (resolve, reject) {
      if (config.logGitCommands) winston.info('git executing: ' + self.repoPath + ' ' + self.commands.join(' '));
      self.startTime = Date.now();

      var gitProcess = child_process.spawn(
        'git',
        self.commands,
        {
          cwd: self.repoPath,
          maxBuffer: 1024 * 1024 * 100,
          timeout: self._timeout
        });
      self.process = gitProcess;
      var allowedCodes = self.allowedCodes || [0];
      var stdout = '';
      var stderr = '';

      if (self.outPipe) {
        gitProcess.stdout.pipe(self.outPipe);
      } else {
        gitProcess.stdout.on('data', function(data) {
          stdout += data.toString();
        });
      }
      gitProcess.stderr.on('data', function(data) {
        stderr += data.toString();
      });
      gitProcess.on('error', function (error) {
        if (self.outPipe) self.outPipe.end();
        reject(error);
      });

      gitProcess.on('close', function (code) {
        if (config.logGitCommands) winston.info('git result (first 400 bytes): ' + self.commands.join(' ') + '\n' + stderr.slice(0, 400) + '\n' + stdout.slice(0, 400));
        if (self.outPipe) self.outPipe.end();

        if (allowedCodes.indexOf(code) < 0) {
          reject(getErrorObject(stderr));
        } else {
          resolve(self._parser ? self._parser(stdout, self.parseArgs) : stdout);
        }
      });
    });
  }
  this.parser = function(parser, parseArgs) {
    this._parser = parser;
    this.parseArgs = parseArgs;
    return this;
  }
  this.timeout = function(timeout) {
    this._timeout = timeout;
    return this;
  }
}
var getErrorObject = function(stderr) {
  var err = {};
  err.isGitError = true;
  err.errorCode = 'unknown';
  err.stackAtCall = this.potentialError.stack;
  err.lineAtCall = this.potentialError.lineNumber;
  err.command = this.commands.join(' ');
  err.workingDirectory = this.repoPath;
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
  return this.getGitExecutionTask(['rev-parse', '--show-toplevel'], repoPath)
    .promise.then(function(rootRepoPath) {
      var HEADFile = path.join(rootRepoPath.trim(), '.git', 'HEAD');
      if (!fs.existsSync(HEADFile))
        throw { errorCode: 'not-a-repository', error: 'No such file: ' + HEADFile };
      return HEADFile;
    }).then(function(HEADFile) {
      return readFile(HEADFile, { encoding: 'utf8' });
    }).then(function(text) {
      var rows = text.toString().split('\n');
      var branch = rows[0].slice('ref: refs/heads/'.length);
      return branch;
    });
}

module.exports = git;
