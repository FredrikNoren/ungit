const child_process = require('child_process');
const gitParser = require('./git-parser');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const addressParser = require('./address-parser');
const _ = require('lodash');
const isWindows = /^win/.test(process.platform);
// eslint-disable-next-line node/no-unsupported-features/es-syntax
const pLimitPromise = import('p-limit');
const fs = require('fs').promises;
const gitEmptyReproSha1 = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'; // https://stackoverflow.com/q/9765453
const gitEmptyReproSha256 = '6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321'; // https://stackoverflow.com/q/9765453
const gitConfigArguments = [
  '-c',
  'color.ui=false',
  '-c',
  'core.quotepath=false',
  '-c',
  'core.pager=cat',
  '-c',
  'core.editor=:',
];
const gitOptionalLocks = config.isGitOptionalLocks ? '--no-optional-locks' : '';
const gitBin = (() => {
  if (config.gitBinPath) {
    return (config.gitBinPath.endsWith('/') ? config.gitBinPath : config.gitBinPath + '/') + 'git';
  }
  return 'git';
})();

const isRetryableError = (err) => {
  const errMsg = (err || {}).error || '';
  // Dued to git operation parallelization it is possible that race condition may happen
  if (errMsg.indexOf("index.lock': File exists") > -1) return true;
  // TODO: Issue #796, based on the conversation with Appveyor team, I guess Windows system
  // can report "Permission denied" for the file locking issue.
  if (errMsg.indexOf('index file open failed: Permission denied') > -1) return true;
  return false;
};

let pLimit = (fn) => {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err);
  }
};
pLimitPromise.then((limit) => {
  pLimit = limit.default(config.maxConcurrentGitOperations);
});

const gitExecutorProm = (args, retryCount) => {
  let timeoutTimer;
  return pLimit(() => {
    return new Promise((resolve, reject) => {
      if (config.logGitCommands)
        logger.info(`git executing: ${args.repoPath} ${args.commands.join(' ')}`);
      let rejectedError = null;
      let stdout = '';
      let stderr = '';
      const env = JSON.parse(JSON.stringify(process.env));
      env['LC_ALL'] = 'C';
      const procOpts = {
        cwd: args.repoPath,
        maxBuffer: 1024 * 1024 * 100,
        detached: false,
        env: env,
      };
      const gitProcess = child_process.spawn(gitBin, args.commands, procOpts);
      timeoutTimer = setTimeout(() => {
        if (!timeoutTimer) return;
        timeoutTimer = null;

        logger.warn(`command timedout: ${args.commands.join(' ')}\n`);
        gitProcess.kill('SIGINT');
      }, args.timeout);

      if (args.outPipe) {
        gitProcess.stdout.pipe(args.outPipe);
      } else {
        gitProcess.stdout.on('data', (data) => (stdout += data.toString()));
      }
      if (args.inPipe) {
        gitProcess.stdin.end(args.inPipe);
      }
      gitProcess.stderr.on('data', (data) => (stderr += data.toString()));
      gitProcess.on('error', (error) => (rejectedError = error));

      gitProcess.on('close', (code) => {
        if (config.logGitCommands)
          logger.info(
            `git result (first 400 bytes): ${args.commands.join(' ')}\n${stderr.slice(
              0,
              400
            )}\n${stdout.slice(0, 400)}`
          );
        if (rejectedError) {
          reject(rejectedError);
        } else if (code === 0 || (code === 1 && args.allowError)) {
          resolve(stdout);
        } else {
          reject(getGitError(args, stderr, stdout));
        }
      });
    });
  })
    .catch((err) => {
      if (retryCount > 0 && isRetryableError(err)) {
        return new Promise((resolve) => {
          logger.warn(
            'retrying git commands after lock acquired fail. (If persists, lower "maxConcurrentGitOperations")'
          );
          // sleep random amount between 250 ~ 750 ms
          setTimeout(resolve, Math.floor(Math.random() * 500 + 250));
        }).then(gitExecutorProm.bind(null, args, retryCount - 1));
      } else {
        throw err;
      }
    })
    .finally(() => {
      if (args.outPipe) args.outPipe.end();
      if (timeoutTimer) clearTimeout(timeoutTimer);
    });
};

/**
 * Returns a promise that executes git command with given arguments.
 *
 * @function
 * @param {Object | string[]} commands    - An object that represents all parameters or first
 *                                        parameter only, which is an array of commands.
 * @param {string}            repoPath    - path to the git repository.
 * @param {boolean=}          allowError  - true if return code of 1 is acceptable as some cases
 *                                        errors are acceptable.
 * @param {WritableStream=}   outPipe     - if this argument exists, stdout is piped to this object.
 * @param {ReadableStream=}   inPipe      - if this argument exists, data is piped to stdin process
 *                                        on start.
 * @param {number=}           timeout     - execution timeout, default is 2 mins.
 * @returns {promise} Execution promise.
 * @example
 *
 *   getGitExecuteTask({ commands: ['show'], repoPath: '/tmp' });
 *
 * @example
 *
 *   getGitExecuteTask(['show'], '/tmp');
 *
 */
const git = (commands, repoPath, allowError, outPipe, inPipe, timeout) => {
  let args = {};
  if (Array.isArray(commands)) {
    args.commands = commands;
    args.repoPath = repoPath;
    args.outPipe = outPipe;
    args.inPipe = inPipe;
    args.allowError = allowError;
    args.timeout = timeout;
  } else {
    args = commands;
  }

  args.commands = gitConfigArguments.concat(
    args.commands.filter((element) => {
      return element;
    })
  );
  args.timeout = args.timeout || 2 * 60 * 1000; // Default timeout tasks after 2 min
  args.startTime = Date.now();

  return gitExecutorProm(args, config.lockConflictRetryCount);
};

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
  err.stdoutLower = (stdout || '').toLowerCase();
  err.stderrLower = (stderr || '').toLowerCase();
  if (err.stderrLower.indexOf('not a git repository') >= 0) {
    err.errorCode = 'not-a-repository';
  } else if (err.stderrLower.indexOf("bad default revision 'head'") != -1) {
    err.errorCode = 'no-head';
  } else if (err.stderrLower.indexOf('does not have any commits yet') != -1) {
    err.errorCode = 'no-commits';
  } else if (err.stderrLower.indexOf('connection timed out') != -1) {
    err.errorCode = 'remote-timeout';
  } else if (err.stderrLower.indexOf('permission denied (publickey)') != -1) {
    err.errorCode = 'permision-denied-publickey';
  } else if (
    err.stderrLower.indexOf('ssh: connect to host') != -1 &&
    err.stderrLower.indexOf('bad file number') != -1
  ) {
    err.errorCode = 'ssh-bad-file-number';
  } else if (err.stderrLower.indexOf('no remote configured to list refs from.') != -1) {
    err.errorCode = 'no-remote-configured';
  } else if (
    (err.stderrLower.indexOf('unable to access') != -1 &&
      err.stderrLower.indexOf('could not resolve host:') != -1) ||
    err.stderrLower.indexOf('could not resolve hostname') != -1
  ) {
    err.errorCode = 'offline';
  } else if (err.stderrLower.indexOf('proxy authentication required') != -1) {
    err.errorCode = 'proxy-authentication-required';
  } else if (err.stderrLower.indexOf('please tell me who you are') != -1) {
    err.errorCode = 'no-git-name-email-configured';
  } else if (
    err.stderrLower.indexOf(
      'fatal error: disconnected: no supported authentication methods available (server sent: publickey)'
    ) == 0
  ) {
    err.errorCode = 'no-supported-authentication-provided';
  } else if (err.stderrLower.indexOf('fatal: no remote repository specified.') == 0) {
    err.errorCode = 'no-remote-specified';
  } else if (err.stderrLower.indexOf('non-fast-forward') != -1) {
    err.errorCode = 'non-fast-forward';
  } else if (
    err.stderrLower.indexOf('failed to merge in the changes.') == 0 ||
    err.stdoutLower.indexOf('conflict (content): merge conflict in') != -1 ||
    err.stderrLower.indexOf('after resolving the conflicts') != -1
  ) {
    err.errorCode = 'merge-failed';
  } else if (err.stderrLower.indexOf('this operation must be run in a work tree') != -1) {
    err.errorCode = 'must-be-in-working-tree';
  } else if (
    err.stderrLower.indexOf(
      'your local changes to the following files would be overwritten by checkout'
    ) != -1
  ) {
    err.errorCode = 'local-changes-would-be-overwritten';
  }

  return err;
};

git.status = (repoPath, file) => {
  return Promise.all([
    // 0: numStatsStaged
    git([gitOptionalLocks, 'diff', '--numstat', '--cached', '-z', '--', file || ''], repoPath).then(
      gitParser.parseGitStatusNumstat
    ),
    // 1: numStatsUnstaged
    config.isEnableNumStat
      ? git([gitOptionalLocks, 'diff', '--numstat', '-z', '--', file || ''], repoPath).then(
          gitParser.parseGitStatusNumstat
        )
      : {},
    // 2: status
    git([gitOptionalLocks, 'status', '-s', '-b', '-u', '-z', file || ''], repoPath)
      .then(gitParser.parseGitStatus)
      .then((status) => {
        return Promise.all([
          // 0: isRebaseMerge
          fs
            .access(path.join(repoPath, '.git', 'rebase-merge'))
            .then(() => true)
            .catch(() => false),
          // 1: isRebaseApply
          fs
            .access(path.join(repoPath, '.git', 'rebase-apply'))
            .then(() => true)
            .catch(() => false),
          // 2: isMerge
          fs
            .access(path.join(repoPath, '.git', 'MERGE_HEAD'))
            .then(() => true)
            .catch(() => false),
          // 3: inCherry
          fs
            .access(path.join(repoPath, '.git', 'CHERRY_PICK_HEAD'))
            .then(() => true)
            .catch(() => false),
        ])
          .then((result) => {
            status.inRebase = result[0] || result[1];
            status.inMerge = result[2];
            status.inCherry = result[3];
          })
          .then(() => {
            if (status.inMerge || status.inCherry) {
              return fs
                .readFile(path.join(repoPath, '.git', 'MERGE_MSG'), { encoding: 'utf8' })
                .then((commitMessage) => {
                  status.commitMessage = commitMessage;
                  return status;
                })
                .catch((err) => {
                  // 'MERGE_MSG' file is gone away, which means we are no longer in merge state
                  // and state changed while this call is being made.
                  status.inMerge = status.inCherry = false;
                  return status;
                });
            }
            return status;
          });
      }),
  ]).then((result) => {
    const numstats = [result[0], result[1]].reduce(_.extend, {});
    const status = result[2];
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
};

git.getRemoteAddress = (repoPath, remoteName) => {
  return git(['config', '--get', `remote.${remoteName}.url`], repoPath).then((text) =>
    addressParser.parseAddress(text.split('\n')[0])
  );
};

git.resolveConflicts = (repoPath, files) => {
  const toAdd = [];
  const toRemove = [];
  return Promise.all(
    (files || []).map((file) => {
      return fs
        .access(path.join(repoPath, file))
        .then(() => {
          toAdd.push(file);
        })
        .catch(() => {
          toRemove.push(file);
        });
    })
  ).then(() => {
    const addExec = toAdd.length > 0 ? git(['add', toAdd], repoPath) : null;
    const removeExec = toRemove.length > 0 ? git(['rm', toRemove], repoPath) : null;
    return Promise.all([addExec, removeExec]);
  });
};

git.stashExecuteAndPop = (commands, repoPath, allowError, outPipe, inPipe, timeout) => {
  let hadLocalChanges = true;

  return git(['stash'], repoPath)
    .catch((err) => {
      if (err.stderr.indexOf('You do not have the initial commit yet') != -1) {
        hadLocalChanges = err.stderr.indexOf('You do not have the initial commit yet') == -1;
      } else {
        throw err;
      }
    })
    .then((result) => {
      if (!result || result.indexOf('No local changes to save') != -1) {
        hadLocalChanges = false;
      }
      return git(commands, repoPath, allowError, outPipe, inPipe, timeout);
    })
    .then(() => {
      return hadLocalChanges ? git(['stash', 'pop'], repoPath) : null;
    });
};

git.binaryFileContent = (repoPath, filename, version, outPipe) => {
  return git(['show', `${version}:${filename}`], repoPath, null, outPipe);
};

git.diffFile = (repoPath, filename, oldFilename, sha1, ignoreWhiteSpace) => {
  if (sha1) {
    return git(['rev-list', '--max-parents=0', sha1], repoPath).then((initialCommitSha1) => {
      const prevSha1 =
        sha1 == initialCommitSha1.trim()
          ? sha1.length == 64
            ? gitEmptyReproSha256
            : gitEmptyReproSha1
          : `${sha1}^`;
      if (oldFilename && oldFilename !== filename) {
        return git(
          [
            'diff',
            ignoreWhiteSpace ? '-w' : '',
            `${prevSha1}:${oldFilename.trim()}`,
            `${sha1}:${filename.trim()}`,
          ],
          repoPath
        );
      } else {
        return git(
          ['diff', ignoreWhiteSpace ? '-w' : '', prevSha1, sha1, '--', filename.trim()],
          repoPath
        );
      }
    });
  }

  return git
    .revParse(repoPath)
    .then((revParse) => {
      return revParse.type === 'bare' ? { files: {} } : git.status(repoPath);
    }) // if bare do not call status
    .then((status) => {
      const file = status.files[filename];
      if (!file) {
        return fs
          .access(path.join(repoPath, filename))
          .then(() => {
            return [];
          })
          .catch(() => {
            throw { error: `No such file: ${filename}`, errorCode: 'no-such-file' };
          });
        // If the file is new or if it's a directory, i.e. a submodule
      } else {
        if (file && file.isNew) {
          return git(
            ['diff', '--no-index', isWindows ? 'NUL' : '/dev/null', filename.trim()],
            repoPath,
            true
          );
        } else if (file && file.renamed) {
          return git(
            ['diff', ignoreWhiteSpace ? '-w' : '', `HEAD:${oldFilename}`, filename.trim()],
            repoPath
          );
        } else {
          return git(
            ['diff', ignoreWhiteSpace ? '-w' : '', 'HEAD', '--', filename.trim()],
            repoPath
          );
        }
      }
    });
};

git.getCurrentBranch = (repoPath) => {
  return git(['branch'], repoPath)
    .then(gitParser.parseGitBranches)
    .then((branches) => {
      const branch = branches.find((branch) => branch.current);
      if (branch) {
        return branch.name;
      } else {
        return '';
      }
    });
};

git.discardAllChanges = (repoPath) => {
  return git(['reset', '--hard', 'HEAD'], repoPath).then(() => {
    return git(['clean', '-fd'], repoPath);
  });
};

git.discardChangesInFile = (repoPath, filename) => {
  return git.status(repoPath, filename).then((status) => {
    if (Object.keys(status.files).length == 0)
      throw new Error(`No files in status in discard, filename: ${filename}`);
    const fileStatus = status.files[Object.keys(status.files)[0]];
    const fullPath = path.join(repoPath, filename);

    if (fileStatus.staged) {
      // if staged, just remove from git
      return git(['rm', '-f', filename], repoPath);
    } else if (fileStatus.isNew) {
      // new file, junst unlink
      return fs.unlink(fullPath).catch((err) => {
        throw { command: 'unlink', error: err };
      });
    }

    return fs
      .stat(fullPath)
      .then((stats) => stats.isDirectory())
      .catch(() => false)
      .then((isSubrepoChange) => {
        if (isSubrepoChange) {
          return git(['submodule', 'sync'], repoPath).then(() =>
            git(['submodule', 'update', '--init', '-f', '--recursive', filename], repoPath)
          );
        } else {
          return git(['checkout', 'HEAD', '--', filename], repoPath);
        }
      });
  });
};

git.applyPatchedDiff = (repoPath, patchedDiff) => {
  if (patchedDiff) {
    return git(['apply', '--cached'], repoPath, null, null, patchedDiff + '\n\n');
  }
};

git.commit = (repoPath, amend, emptyCommit, message, files) => {
  return new Promise((resolve, reject) => {
    if (message == undefined) {
      reject({ error: 'Must specify commit message' });
    }
    if ((!Array.isArray(files) || files.length == 0) && !amend && !emptyCommit) {
      reject({ error: 'Must specify files or amend to commit' });
    }
    resolve();
  })
    .then(() => {
      return git.status(repoPath);
    })
    .then((status) => {
      const toAdd = [];
      const toRemove = [];
      const promises = []; // promises that patches each files individually

      for (const v in files) {
        const file = files[v];
        const fileStatus =
          status.files[file.name] || status.files[path.relative(repoPath, file.name)];
        if (!fileStatus) {
          throw { error: `No such file in staging: ${file.name}` };
        }

        if (fileStatus.removed) {
          toRemove.push(file.name.trim());
        } else if (files[v].patchLineList) {
          promises.push(
            git(['diff', '--', file.name.trim()], repoPath)
              .then(gitParser.parsePatchDiffResult.bind(null, file.patchLineList))
              .then(git.applyPatchedDiff.bind(null, repoPath))
          );
        } else {
          toAdd.push(file.name.trim());
        }
      }

      promises.push(
        Promise.resolve()
          .then(() => {
            if (toRemove.length > 0)
              return git(
                ['update-index', '--remove', '--stdin'],
                repoPath,
                null,
                null,
                toRemove.join('\n')
              );
          })
          .then(() => {
            if (toAdd.length > 0)
              return git(
                ['update-index', '--add', '--stdin'],
                repoPath,
                null,
                null,
                toAdd.join('\n')
              );
          })
      );

      return Promise.all(promises);
    })
    .then(() => {
      const ammendFlag = amend ? '--amend' : '';
      const allowedEmptyFlag = emptyCommit || amend ? '--allow-empty' : '';
      const isGPGSign = config.isForceGPGSign ? '-S' : '';
      return git(
        ['commit', ammendFlag, allowedEmptyFlag, isGPGSign, '--file=-'],
        repoPath,
        null,
        null,
        message
      );
    })
    .catch((err) => {
      // ignore the case where nothing were added to be committed
      if (!err.stdout || err.stdout.indexOf('Changes not staged for commit') === -1) {
        throw err;
      }
    });
};

git.revParse = (repoPath) => {
  return git(['rev-parse', '--is-inside-work-tree', '--is-bare-repository'], repoPath)
    .then((result) => {
      const resultLines = result.split('\n');
      if (resultLines[1].indexOf('true') > -1) {
        // bare repositories don't support `--show-toplevel` since git 2.25
        return { type: 'bare', gitRootPath: repoPath };
      }
      return git(['rev-parse', '--show-toplevel'], repoPath).then((topLevel) => {
        const rootPath = path.normalize(topLevel.trim() ? topLevel.trim() : repoPath);
        if (resultLines[0].indexOf('true') > -1) {
          return { type: 'inited', gitRootPath: rootPath };
        }
        return { type: 'uninited', gitRootPath: rootPath };
      });
    })
    .catch((err) => {
      return { type: 'uninited', gitRootPath: path.normalize(repoPath) };
    });
};

git.log = (path, limit, skip, maxActiveBranchSearchIteration) => {
  return git(
    [
      'log',
      '--cc',
      '--decorate=full',
      '--show-signature',
      '--date=default',
      '--pretty=fuller',
      '-z',
      '--branches',
      '--tags',
      '--remotes',
      '--parents',
      '--no-notes',
      '--numstat',
      '--date-order',
      `--max-count=${limit}`,
      `--skip=${skip}`,
    ],
    path
  )
    .then(gitParser.parseGitLog)
    .then((log) => {
      log = log ? log : [];
      if (maxActiveBranchSearchIteration > 0 && !log.isHeadExist && log.length > 0) {
        return git
          .log(
            path,
            config.numberOfNodesPerLoad + limit,
            config.numberOfNodesPerLoad + skip,
            maxActiveBranchSearchIteration - 1
          )
          .then((innerLog) => {
            return {
              limit: limit + (innerLog.isHeadExist ? 0 : config.numberOfNodesPerLoad),
              skip: skip + (innerLog.isHeadExist ? 0 : config.numberOfNodesPerLoad),
              nodes: log.concat(innerLog.nodes),
              isHeadExist: innerLog.isHeadExist,
            };
          });
      } else {
        return { limit: limit, skip: skip, nodes: log, isHeadExist: log.isHeadExist };
      }
    });
};

module.exports = git;
