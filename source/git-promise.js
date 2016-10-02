const child_process = require('child_process');
const gitParser = require('./git-parser');
const path = require('path');
const config = require('./config');
const winston = require('winston');
const addressParser = require('./address-parser');
const _ = require('lodash');
const isWindows = /^win/.test(process.platform);
const Bluebird = require('bluebird');
const fs = require('./utils/fs-async');
const async = require('async');
const gitConfigArguments = ['-c', 'color.ui=false', '-c', 'core.quotepath=false', '-c', 'core.pager=cat'];

const gitQueue = async.queue((args, callback) => {
  if (config.logGitCommands) winston.info(`git executing: ${args.repoPath} ${args.commands.join(' ')}`);
  let rejected = false;
  let stdout = '';
  let stderr = '';
  const gitProcess = child_process.spawn(
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
    gitProcess.stdout.on('data', (data) => stdout += data.toString());
  }
  if (args.inPipe) {
    gitProcess.stdin.end(args.inPipe);
  }
  gitProcess.stderr.on('data', (data) => stderr += data.toString());
  gitProcess.on('error', (error) => {
    if (args.outPipe) args.outPipe.end();
    rejected = true;
    callback(error);
  });

  gitProcess.on('close', (code) => {
    if (config.logGitCommands) winston.info(`git result (first 400 bytes): ${args.commands.join(' ')}\n${stderr.slice(0, 400)}\n${stdout.slice(0, 400)}`);
    if (rejected) return;
    if (args.outPipe) args.outPipe.end();

    if (code === 0 || (code === 1 && args.allowError)) {
      callback(null, stdout);
    } else {
      callback(getGitError(args, stderr, stdout));
    }
  });
}, config.maxConcurrentGitOperations);

const isRetryableError = function(err) {
  if (!err) {
    return false;
  } else if (!err.error) {
    return false;
  } else if (err.error.indexOf("index.lock': File exists") > -1) {
    // Dued to git operation parallelization it is possible that race condition may happen
    return true;
  } else if (err.error.indexOf("index file open failed: Permission denied") > -1) {
    // TODO: Issue #796, based on the conversation with Appveyor team, I guess Windows system
    // can report "Permission denied" for the file locking issue.
    return true;
  } else {
    return false;
  }
}

const gitExecutorProm = (args, retryCount) => {
  return new Bluebird((resolve, reject) => {
    gitQueue.push(args, (queueError, out) => {
      if(queueError) {
        reject(queueError);
      } else {
        resolve(out);
      }
    });
  }).catch((err) => {
    if (retryCount > 0 && isRetryableError(err)) {
      return new Bluebird((resolve) => {
        // sleep random amount between 250 ~ 750 ms
        setTimeout(resolve, Math.floor(Math.random() * (500) + 250));
      }).then(gitExecutorProm.bind(null, args, retryCount - 1));
    } else {
      throw err;
    }
  });
}

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
const git = (commands, repoPath, allowError, outPipe, inPipe, timeout) => {
  let args = {};
  if (Array.isArray(commands)) {
    args.commands = commands;
    args.repoPath = repoPath;
    args.outPipe = outPipe;
    args.inPipe = inPipe;
    args.allowError = allowError;
  } else {
    args = commands;
  }

  args.commands = gitConfigArguments.concat(args.commands.filter((element) => {
    return element;
  }));
  args.timeout = args.timeout || 2 * 60 * 1000; // Default timeout tasks after 2 min
  args.startTime = Date.now();

  return gitExecutorProm(args, config.lockConflictRetryCount);
}

const getGitError = (args, stderr, stdout) => {
  const err = {};
  err.isGitError = true;
  err.errorCode = 'unknown';
  err.command = args.commands.join(' ');
  err.workingDirectory = args.repoPath;
  err.error = stderr.toString();
  err.message = err.error.split('\n')[0];
  err.stderr = stderr;
  err.stdout = stdout;
  if (stderr.indexOf('Not a git repository') >= 0) {
    err.errorCode = 'not-a-repository';
  } else if (err.stderr.indexOf('Connection timed out') != -1) {
    err.errorCode = 'remote-timeout';
  } else if (err.stderr.indexOf('Permission denied (publickey)') != -1) {
    err.errorCode = 'permision-denied-publickey';
  } else if (err.stderr.indexOf('ssh: connect to host') != -1 && err.stderr.indexOf('Bad file number') != -1) {
    err.errorCode = 'ssh-bad-file-number';
  } else if (err.stderr.indexOf('No remote configured to list refs from.') != -1) {
    err.errorCode = 'no-remote-configured';
  } else if ((err.stderr.indexOf('unable to access') != -1 && err.stderr.indexOf('Could not resolve host:') != -1) ||
    (err.stderr.indexOf('Could not resolve hostname') != -1)) {
    err.errorCode = 'offline';
  } else if (err.stderr.indexOf('Proxy Authentication Required') != -1) {
    err.errorCode = 'proxy-authentication-required';
  } else if (err.stderr.indexOf('Please tell me who you are') != -1) {
    err.errorCode = 'no-git-name-email-configured';
  } else if (err.stderr.indexOf('FATAL ERROR: Disconnected: No supported authentication methods available (server sent: publickey)') == 0) {
    err.errorCode = 'no-supported-authentication-provided';
  } else if (stderr.indexOf('fatal: No remote repository specified.') == 0) {
    err.errorCode = 'no-remote-specified';
  } else if (err.stderr.indexOf('non-fast-forward') != -1) {
    err.errorCode = 'non-fast-forward';
  } else if (err.stderr.indexOf('Failed to merge in the changes.') == 0 || err.stdout.indexOf('CONFLICT (content): Merge conflict in') != -1 || err.stderr.indexOf('after resolving the conflicts') != -1) {
    err.errorCode = 'merge-failed';
  } else if (err.stderr.indexOf('This operation must be run in a work tree') != -1) {
    err.errorCode = 'must-be-in-working-tree';
  } else if (err.stderr.indexOf('Your local changes to the following files would be overwritten by checkout') != -1) {
    err.errorCode = 'local-changes-would-be-overwritten';
  }

  return err;
}

git.status = (repoPath, file) => {
  return Bluebird.props({
    numStatsStaged: git(['diff', '--no-renames', '--numstat', '--cached', '--', (file || '')], repoPath)
      .then(gitParser.parseGitStatusNumstat),
    numStatsUnstaged: git(['diff', '--no-renames', '--numstat', '--', (file || '')], repoPath)
      .then(gitParser.parseGitStatusNumstat),
    status: git(['status', '-s', '-b', '-u', (file || '')], repoPath)
      .then(gitParser.parseGitStatus)
      .then((status) => {
        return Bluebird.props({
          isRebaseMerge: fs.isExists(path.join(repoPath, '.git', 'rebase-merge')),
          isRebaseApply: fs.isExists(path.join(repoPath, '.git', 'rebase-apply')),
          isMerge: fs.isExists(path.join(repoPath, '.git', 'MERGE_HEAD')),
          inCherry: fs.isExists(path.join(repoPath, '.git', 'CHERRY_PICK_HEAD'))
        }).then((result) => {
          status.inRebase = result.isRebaseMerge || result.isRebaseApply;
          status.inMerge = result.isMerge;
          status.inCherry = result.inCherry;
        }).then(() => {
          if (status.inMerge || status.inCherry) {
            return fs.readFileAsync(path.join(repoPath, '.git', 'MERGE_MSG'), { encoding: 'utf8' })
              .then((commitMessage) => {
                status.commitMessage = commitMessage;
                return status;
              }).catch(err => {
                // 'MERGE_MSG' file is gone away, which means we are no longer in merge state
                // and state changed while this call is being made.
                status.inMerge = status.inCherry = false;
                return status;
              });
          }
          return status;
        });
      })
  }).then((result) => {
    const numstats = [result.numStatsStaged, result.numStatsUnstaged].reduce(_.extend, {});
    const status = result.status;
    status.inConflict = false;

    // merge numstats
    Object.keys(status.files).forEach((filename) => {
      // git diff returns paths relative to git repo but git status does not
      const absoluteFilename = filename.replace(/\.\.\//g, '');
      const stats = numstats[absoluteFilename] || { additions: '-', deletions: '-' };
      const fileObj = status.files[filename];
      fileObj.additions = stats.additions;
      fileObj.deletions = stats.deletions;
      if (!status.inConflict && fileObj.conflict) {
        status.inConflict = true;
      }
    });

    return status;
  });
}

git.getRemoteAddress = (repoPath, remoteName) => {
  return git(['config', '--get', `remote.${remoteName}.url`], repoPath)
    .then((text) => addressParser.parseAddress(text.split('\n')[0]));
}

git.resolveConflicts = (repoPath, files) => {
  const toAdd = [];
  const toRemove = [];
  return Bluebird.all((files || []).map((file) => {
    return fs.isExists(path.join(repoPath, file)).then((isExist) => {
      if (isExist) {
        toAdd.push(file);
      } else {
        toRemove.push(file);
      }
    });
  })).then(() => {
    const addExec = toAdd.length > 0 ? git(['add', toAdd ], repoPath) : null;
    const removeExec = toRemove.length > 0 ? git(['rm', toRemove ], repoPath) : null;
    return Bluebird.join(addExec, removeExec);
  });
}

git.stashExecuteAndPop = (commands, repoPath, allowError, outPipe, inPipe, timeout) => {
  let hadLocalChanges = true;

  return git(['stash'], repoPath)
    .catch((err) => {
      if (err.stderr.indexOf('You do not have the initial commit yet') != -1) {
        hadLocalChanges = err.stderr.indexOf('You do not have the initial commit yet') == -1;
      } else {
        throw err;
      }
    }).then((result) => {
      if (result.indexOf('No local changes to save') != -1) {
        hadLocalChanges = false;
      }
      return git(commands, repoPath, allowError, outPipe, inPipe, timeout);
    }).then(() => { return hadLocalChanges ? git(['stash', 'pop'], repoPath) : null });
}

git.binaryFileContent = (repoPath, filename, version, outPipe) => {
  return git(['show', `${version}:${filename}`], repoPath, null, outPipe);
}

git.diffFile = (repoPath, filename, sha1, ignoreWhiteSpace) => {
  const newFileDiffArgs = ['diff', '--no-index', isWindows ? 'NUL' : '/dev/null', filename.trim()];
  return git.revParse(repoPath)
    .then((revParse) => { return revParse.type === 'bare' ? { files: {} } : git.status(repoPath) }) // if bare do not call status
    .then((status) => {
      const file = status.files[filename];

      if (!file && !sha1) {
        return fs.isExists(path.join(repoPath, filename))
          .then((isExist) => {
            if (isExist) return [];
            else throw { error: `No such file: ${filename}`, errorCode: 'no-such-file' };
          });
        // If the file is new or if it's a directory, i.e. a submodule
      } else {
        let exec;
        if (file && file.isNew) {
          exec = git(newFileDiffArgs, repoPath, true);
        } else if (sha1) {
          exec = git(['diff', ignoreWhiteSpace ? '-w' : '', `${sha1}^`, sha1, "--", filename.trim()], repoPath);
        } else {
          exec = git(['diff', ignoreWhiteSpace ? '-w' : '', 'HEAD', '--', filename.trim()], repoPath);
        }
        return exec.catch((err) => {
          // when <rev> is very first commit and 'diff <rev>~1:[file] <rev>:[file]' is performed,
          // it will error out with invalid object name error
          if (sha1 && err && err.error.indexOf('bad revision') > -1)
            return git(newFileDiffArgs, repoPath, true);
        });
      }
    });
}

git.getCurrentBranch = (repoPath) => {
  return git.revParse(repoPath).then(revResult => {
    const HEADFile = path.join(revResult.gitRootPath, '.git', 'HEAD');
    return fs.isExists(HEADFile).then(isExist => {
      if (!isExist) throw { errorCode: 'not-a-repository', error: `No such file: ${HEADFile}` };
    }).then(() => {
      return fs.readFileAsync(HEADFile, { encoding: 'utf8' });
    }).then(text => {
      const rows = text.toString().split('\n');
      return rows[0].slice('ref: refs/heads/'.length);
    });
  });
}

git.discardAllChanges = (repoPath) => {
  return git(['reset', '--hard', 'HEAD'], repoPath)
    .then(() => { return git(['clean', '-fd'], repoPath) });
}

git.discardChangesInFile = (repoPath, filename) => {
  return git.status(repoPath, filename)
    .then((status) => {
      if (Object.keys(status.files).length == 0) throw new Error(`No files in status in discard, filename: ${filename}`);
      const fileStatus = status.files[Object.keys(status.files)[0]];

      if (!fileStatus.staged) {
        // If it's just a new file, remove it
        if (fileStatus.isNew) {
          return fs.unlinkAsync(path.join(repoPath, filename))
            .catch((err) => {
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

git.applyPatchedDiff = (repoPath, patchedDiff) => {
  if (patchedDiff) {
    return git(['apply', '--cached'], repoPath, null, null, patchedDiff + '\n\n');
  }
}

git.commit = (repoPath, amend, message, files) => {
  return (new Bluebird((resolve, reject) => {
    if (message == undefined) {
      reject({ error: 'Must specify commit message' });
    }
    if ((!(Array.isArray(files)) || files.length == 0) && !amend) {
      reject({ error: 'Must specify files or amend to commit' });
    }
    resolve();
  })).then(() => {
    return git.status(repoPath);
  }).then((status) => {
    const toAdd = [];
    const toRemove = [];
    const diffPatchPromises = []; // promiese that patches each files individually

    for (let v in files) {
      let file = files[v];
      let fileStatus = status.files[file.name] || status.files[path.relative(repoPath, file.name)];
      if (!fileStatus) {
        throw { error: `No such file in staging: ${file.name}` };
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

    let commitPromiseChain = Bluebird.resolve()
      .then(() => {
        if (toRemove.length > 0) return git(['update-index', '--remove', '--stdin'], repoPath, null, null, toRemove.join('\n'));
      }).then(() => {
        if (toAdd.length > 0) return git(['update-index', '--add', '--stdin'], repoPath, null, null, toAdd.join('\n'));
      });

    return Bluebird.join(commitPromiseChain, Bluebird.all(diffPatchPromises));
  }).then(() => {
    return git(['commit', (amend ? '--amend' : ''), '--file=-'], repoPath, null, null, message);
  }).catch((err) => {
    // ignore the case where nothing were added to be committed
    if (!err.stdout || err.stdout.indexOf("Changes not staged for commit") === -1) {
      throw err;
    }
  });
}

git.revParse = (repoPath) => {
  return git(['rev-parse', '--is-inside-work-tree', '--is-bare-repository', '--show-toplevel'], repoPath)
    .then((result) => {
      const resultLines = result.toString().split('\n');
      const rootPath = path.normalize(resultLines[2] ? resultLines[2] : repoPath);
      if (resultLines[0].indexOf('true') > -1) {
        return { type: 'inited', gitRootPath: rootPath };
      } else if (resultLines[1].indexOf('true') > -1) {
        return { type: 'bare', gitRootPath: rootPath };
      }
      return { type: 'uninited', gitRootPath: rootPath };
    }).catch((err) => ({ type: 'uninited', gitRootPath: path.normalize(repoPath) }));
}

git.log = (path, limit, skip, maxSearchIteration) => {
  return git(['log', '--decorate=full', '--date=default', '--pretty=fuller', '--branches', '--tags', '--remotes', '--parents', '--no-notes', '--numstat', '--date-order', `--max-count=${limit}`, `--skip=${skip}`], path)
    .then(gitParser.parseGitLog)
    .then((log) => {
      log = log ? log : [];
      if (config.alwaysLoadActiveBranch && !log.isHeadExist && maxSearchIteration) {
        if (maxSearchIteration - 1) {
          return git.log(path, config.numberOfNodesPerLoad + limit, config.numberOfNodesPerLoad + skip, maxSearchIteration - 1);
        } else {
          return git.log(path, config.numberOfNodesPerLoad, 0, maxSearchIteration - 1);
        }
      } else {
        return { "limit": limit, "skip": skip, "nodes": log};
      }
    });
}

module.exports = git;
