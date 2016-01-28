var child_process = require('child_process');
var gitParser = require('./git-parser');
var path = require('path');
var config = require('./config');
var winston = require('winston');
var addressParser = require('./address-parser');
var _ = require('lodash');
var isWindows = /^win/.test(process.platform);
var Promise = require('bluebird');
var fs = require('./utils/fs-async');
var gitConfigArguments = ['-c', 'color.ui=false', '-c', 'core.quotepath=false', '-c', 'core.pager=cat'];

/**
 * Returns a promise that executes git command with given arguments
 * @function
 * @param {obj|array} commands - An object that represents all parameters or first parameter only, which is an array of commands
 * @param {string} repoPath - path to the git repository
 * @param {boolean=} allowError - true if return code of 1 is acceptable as some cases errors are acceptable
 * @param {stream=} outPipe - if this argument exists, stdout is piped to this object
 * @param {stream=} inPipe - if this argument exists, data is piped to stdin process on start
 * @param {timeout=} timeout - execution timeout, default is 2 mins
 * @returns {promise} execution promise
 * @example getGitExecuteTask({ commands: ['show'], repoPath: '/tmp' });
 * @example getGitExecuteTask(['show'], '/tmp');
 */
var git = function(commands, repoPath, allowError, outPipe, inPipe, timeout) {
  var args = {};
  if (Array.isArray(commands)) {
    args.commands = commands;
    args.repoPath = repoPath;
    args.outPipe = outPipe;
    args.inPipe = inPipe;
  } else {
    args = commands;
  }

  args.commands = gitConfigArguments.concat(args.commands).filter(function(element) {
    return element;
  });
  args.timeout = args.timeout || 2 * 60 * 1000; // Default timeout tasks after 2 min
  args.startTime = Date.now();

  return new Promise(function (resolve, reject) {
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

    if (args.outPipe) {
      gitProcess.stdout.pipe(args.outPipe);
    } else {
      gitProcess.stdout.on('data', function(data) {
        stdout += data.toString();
      });
    }
    if (args.inPipe) {
      gitProcess.stdin.end(args.inPipe);
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

      if (code === 0 || (code === 1 && allowError)) {
        resolve(stdout);
      } else {
        reject(getGitError(args, stderr, stdout));
      }
    });
  });
}

var getGitError = function(args, stderr, stdout) {
  var err = {};
  err.isGitError = true;
  err.errorCode = 'unknown';
  err.command = args.commands.join(' ');
  err.workingDirectory = args.repoPath;
  err.error = stderr.toString();
  err.message = err.error.split('\n')[0];
  err.stderr = stderr;
  err.stdout = stdout;
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
    numStatsStaged: git(['diff', '--numstat', '--cached', '--', (file || '')], repoPath)
      .then(gitParser.parseGitStatusNumstat),
    numStatsUnstaged: git(['diff', '--numstat', '--', (file || '')], repoPath)
      .then(gitParser.parseGitStatusNumstat),
    status: git(['status', '-s', '-b', '-u', (file || '')], repoPath)
      .then(gitParser.parseGitStatus)
      .then(function(status) {
        return Promise.props({
          isRebaseMerge: fs.isExists(path.join(repoPath, '.git', 'rebase-merge')),
          isRebaseApply: fs.isExists(path.join(repoPath, '.git', 'rebase-apply')),
          isMerge: fs.isExists(path.join(repoPath, '.git', 'MERGE_HEAD')),
        }).then(function(result) {
          status.inRebase = result.isRebaseMerge || result.isRebaseApply;
          status.inMerge = result.isMerge;
        }).then(function() {
          if (status.inMerge) {
            return fs.readFileAsync(path.join(repoPath, '.git', 'MERGE_MSG'), { encoding: 'utf8' })
              .then(function(commitMessage) {
                status.commitMessage = commitMessage;
                return status;
              });
          }
          return status;
        });
      })
  }).then(function(result) {
    var numstats = [result.numStatsStaged, result.numStatsUnstaged].reduce(_.extend, {});

    // merge numstats
    Object.keys(result.status.files).forEach(function(filename) {
      // git diff returns paths relative to git repo but git status does not
      var absoluteFilename = filename.replace(/\.\.\//g, '');
      var stats = numstats[absoluteFilename] || { additions: '-', deletions: '-' };
      result.status.files[filename].additions = stats.additions;
      result.status.files[filename].deletions = stats.deletions;
    });

    return result.status;
  });
}

git.getRemoteAddress = function(repoPath, remoteName) {
  return git(['config', '--get', 'remote.' + remoteName + '.url'], repoPath)
    .then(function(text) {
      return addressParser.parseAddress(text.split('\n')[0]);
    });
}

git.resolveConflicts = function(repoPath, files) {
  var toAdd = [];
  var toRemove = [];
  return Promise.all((files || []).map(function(file) {
    return fs.isExists(path.join(repoPath, file)).then(function(isExist) {
      if (isExist) {
        toAdd.push(file);
      } else {
        toRemove.push(file);
      }
    });
  })).then(function() {
    var addExec;
    var removeExec;
    if (toAdd.length > 0)
      addExec = git(['add', toAdd ], repoPath);
    if (toRemove.length > 0)
      removeExec = git(['rm', toRemove ], repoPath);
    return Promise.join(addExec, removeExec);
  });
}

git.stashExecuteAndPop = function(commands, repoPath, allowError, outPipe, inPipe, timeout) {
  var hadLocalChanges = true;

  return git(['stash'], repoPath)
    .catch(function(err) {
      if (err.stderr.indexOf('You do not have the initial commit yet') != -1) {
        hadLocalChanges = err.stderr.indexOf('You do not have the initial commit yet') == -1;
      } else {
        throw err;
      }
    }).then(function(result) {
      if (result.indexOf('No local changes to save') != -1) {
        hadLocalChanges = false;
      }
      return git(commands, repoPath, allowError, outPipe, inPipe, timeout);
    }).then(function() {
      return hadLocalChanges ? git(['stash', 'pop'], repoPath) : null;
    });
}

git.binaryFileContent = function(repoPath, filename, version, outPipe) {
  return git(['show', version + ':' + filename], repoPath, null, outPipe);
}

git.diffFile = function(repoPath, filename, sha1) {
  var newFileDiffArgs = ['diff', '--no-index', isWindows ? 'NUL' : '/dev/null', filename.trim()];
  return git.status(repoPath)
    .then(function(status) {
      var file = status.files[filename];

      if (!file && !sha1) {
        return fs.isExists(path.join(repoPath, filename))
          .then(function(isExist) {
            if (isExist) return [];
            else throw { error: 'No such file: ' + filename, errorCode: 'no-such-file' };
          });
        // If the file is new or if it's a directory, i.e. a submodule
      } else {
        var exec;
        if (file && file.isNew) {
          exec = git(newFileDiffArgs, repoPath, true);
        } else if (sha1) {
          exec = git(['diff', sha1 + "^", sha1, "--", filename.trim()], repoPath);
        } else {
          exec = git(['diff', 'HEAD', '--', filename.trim()], repoPath);
        }
        return exec.catch(function(err) {
          // when <rev> is very first commit and 'diff <rev>~1:[file] <rev>:[file]' is performed,
          // it will error out with invalid object name error
          if (sha1 && err && err.error.indexOf('bad revision') > -1)
            return git(newFileDiffArgs, repoPath, true);
        });
      }
    });
}

git.getCurrentBranch = function(repoPath) {
  var HEADFile;
  return git(['rev-parse', '--show-toplevel'], repoPath)
    .then(function(rootRepoPath) {
      HEADFile = path.join(rootRepoPath.trim(), '.git', 'HEAD');
    }).then(function() {
      return fs.isExists(HEADFile).then(function(isExist) {
        if (!isExist) throw { errorCode: 'not-a-repository', error: 'No such file: ' + HEADFile };
      });
    }).then(function() {
      return fs.readFileAsync(HEADFile, { encoding: 'utf8' });
    }).then(function(text) {
      var rows = text.toString().split('\n');
      var branch = rows[0].slice('ref: refs/heads/'.length);
      return branch;
    });
}

git.discardAllChanges = function(repoPath) {
  return git(['reset', '--hard', 'HEAD'], repoPath)
    .then(function() {
      return git(['clean', '-fd'], repoPath);
    });
}

git.discardChangesInFile = function(repoPath, filename) {
  return git.status(repoPath, filename)
    .then(function(status){
      if (Object.keys(status.files).length == 0) throw new Error('No files in status in discard, filename: ' + filename);
      var fileStatus = status.files[Object.keys(status.files)[0]];

      if (!fileStatus.staged) {
        // If it's just a new file, remove it
        if (fileStatus.isNew) {
          return fs.unlinkAsync(path.join(repoPath, filename))
            .catch(function(err) {
              throw { command: 'unlink', error: err };
            });
        // If it's a changed file, reset the changes
        } else {
          return git(['checkout', 'HEAD', '--', filename], repoPath);
        }
      } else {
        return git(['rm', '-f', filename], repoPath);
      }
    });
}

git.applyPatchedDiff = function(repoPath, patchedDiff) {
  if (patchedDiff) {
    return git(['apply', '--cached'], repoPath, null, null, patchedDiff + '\n\n');
  }
}

git.commit = function(repoPath, amend, message, files) {
  return (new Promise(function(resolve, reject) {
    if (message == undefined) {
      reject({ error: 'Must specify commit message' });
    }
    if ((!(Array.isArray(files)) || files.length == 0) && !amend) {
      reject({ error: 'Must specify files or amend to commit' });
    }
    resolve();
  })).then(function() {
    return git.status(repoPath);
  }).then(function(status) {
    var toAdd = [];
    var toRemove = [];
    var addPromise;     // a promise that add all files in toAdd
    var removePromise;  // a proimse that removes all files in toRemove
    var diffPatchPromises = []; // promiese that patches each files individually

    for (var v in files) {
      var file = files[v];
      var fileStatus = status.files[file.name] || status.files[path.relative(repoPath, file.name)];
      if (!fileStatus) {
        throw { error: 'No such file in staging: ' + file.name };
      }

      if (fileStatus.removed) {
        toRemove.push(file.name.trim());
      } else if (files[v].patchLineList) {
        diffPatchPromises.push(git(['diff', file.name.trim()], repoPath)
          .then(gitParser.parsePatchDiffResult.bind(null, file.patchLineList))
          .then(git.applyPatchedDiff.bind(null, repoPath)));
      } else {
        toAdd.push(file.name.trim());
      }
    }

    if (toAdd.length > 0) {
      addPromise = git(['update-index', '--add', '--stdin'], repoPath, null, null, toAdd.join('\n'));
    }
    if (toRemove.length > 0) {
      removePromise = git(['update-index', '--remove', '--stdin'], repoPath, null, null, toRemove.join('\n'));
    }

    return Promise.join(addPromise, removePromise, Promise.all(diffPatchPromises));
  }).then(function() {
    return git(['commit', (amend ? '--amend' : ''), '--file=-'], repoPath, null, null, message);
  }).catch(function(err) {
    // ignore the case where nothing were added to be committed
    if (err.stdout.indexOf("Changes not staged for commit") === -1)
      throw err;
  });
}

module.exports = git;
