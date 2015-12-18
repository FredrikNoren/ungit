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
var isFileExisProm = function(file) {
  return fileAccessProm(file, fs.F_OK)
    .then(function() { return true; })
    .catch(function() { return false; });
}

var git = {};

/**
 * Returns a promise that executes git command with given arguments
 * @function send
 * @param {array|obj} commands - An object that represents all parameters or the first parameter, which is an array of commands
 * @param {string} repoPath - path to the git repository
 * @param {array=} allowedCodes - array of acceptable execution return code to sometimes accept error as a success
 * @param {stream=} outPipe - if this argument exists, stdout is piped to this object
 * @param {timeout=} outPipe - execution timeout, default is 2 mins
 * @returns {promise} execution promise
 * @example getGitExecuteTask({commands: ['show'], repoPath: '/tmp'});
 * @example getGitExecuteTask(['show'], '/tmp');
 */
git.getGitExecuteTask = function(commands, repoPath, allowedCodes, outPipe, timeout) {
  var args = {};
  if (Array.isArray(commands)) {
    args.commands = commands;
    args.repoPath = repoPath;
    args.allowedCodes = allowedCodes;
    args.outPipe = outPipe;
  } else {
    args = commands;
  }

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

git.status = function(repoPath, file) {
  return Promise.props({
    numStatsStaged: this.getGitExecuteTask(['diff', '--numstat', '--cached', '--', (file || '')], repoPath)
      .then(gitParser.parseGitStatusNumstat),
    numStatsUnstaged: this.getGitExecuteTask(['diff', '--numstat', '--', (file || '')], repoPath)
      .then(gitParser.parseGitStatusNumstat),
    status: this.getGitExecuteTask(['status', '-s', '-b', '-u', (file || '')], repoPath)
      .then(gitParser.parseGitStatus)
      .then(function(status) {
        return Promise.props({
          isRebaseMerge: isFileExisProm(path.join(repoPath, '.git', 'rebase-merge')),
          isRebaseApply: isFileExisProm(path.join(repoPath, '.git', 'rebase-apply')),
          isMerge: isFileExisProm(path.join(repoPath, '.git', 'MERGE_HEAD')),
        }).then(function(result) {
          status.inRebase = result.isRebaseMerge || result.isRebaseApply;
          status.inMerge = result.isMerge;
        }).then(function() {
          if (status.inMerge) {
            return readFileProm(path.join(repoPath, '.git', 'MERGE_MSG'), { encoding: 'utf8' })
              .then(function(commitMessage) {
                status.commitMessage = commitMessage;
                return status;
              });
          }
          return status;
        });
      })
  }).then(function(result) {
    var status = result[0];
    var numstats = [result.numStatsStaged, result.numStatsUnstaged].reduce(_.extend, {});

    // merge numstats
    Object.keys(status.files).forEach(function(filename) {
      // git diff returns paths relative to git repo but git status does not
      var absoluteFilename = filename.replace(/\.\.\//g, '');
      var stats = numstats[absoluteFilename] || { additions: '-', deletions: '-' };
      status.files[filename].additions = stats.additions;
      status.files[filename].deletions = stats.deletions;
    });

    return status;
  });
}

git.resolveConflicts = function(repoPath, files) {
  var toAdd = [];
  var toRemove = [];
  return Promise.all((files || []).map(function(file) {
      return fileAccessProm(file, fs.F_OK)
        .then(function() {
          toAdd.push(file);
        }).catch(function() {
          toRemove.push(file);
        });
    })).then(function() {
      var gitExecProm = [];
      if (toAdd.length > 0) gitExecProm.push(this.getGitExecuteTask(['add', toAdd ], repoPath));
      if (toRemove.length > 0) gitExecProm.push(this.getGitExecuteTask(['rm', toRemove ], repoPath));
      return Promise.join(gitExecProm);
    });
}

git.getCurrentBranch = function(repoPath) {
  var HEADFile;
  return this.getGitExecuteTask(['rev-parse', '--show-toplevel'], repoPath)
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
