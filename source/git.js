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

var gitConfigNoColors = '-c color.ui=false';
var gitConfigNoSlashesInFiles = '-c core.quotepath=false';
var gitConfigCliPager = '-c core.pager=cat';
var isWindows = /^win/.test(process.platform);

var git = function(command, repoPath) {
  command = 'git ' + gitConfigNoColors + ' ' + gitConfigNoSlashesInFiles + ' ' + gitConfigCliPager + ' ' + command;

  return new GitExecutionTask(command, repoPath);
}


var GitExecutionTask = function(command, repoPath) {
  GitTask.call(this);
  var self = this;
  this.repoPath = repoPath;
  this.command = command;
  this._timeout = 2*60*1000; // Default timeout tasks after 2 min
  this.potentialError = new Error(); // caputers the stack trace here so that we can use it if the command fail later on
  this.start = function() {
    git.queueTask(self);
  }
}
inherits(GitExecutionTask, GitTask);
GitExecutionTask.prototype.parser = function(parser, parseArgs) {
  this._parser = parser;
  this.parseArgs = parseArgs;
  return this;
}
GitExecutionTask.prototype.encoding = function(encoding) {
  this._encoding = encoding;
  return this;
}
GitExecutionTask.prototype.timeout = function(timeout) {
  this._timeout = timeout;
  return this;
}


git.runningTasks = [];

var gitQueue = async.queue(function (task, callback) {
  if (config.logGitCommands) winston.info('git executing: ' + task.repoPath + ' ' + task.command);
  git.runningTasks.push(task);
  task.startTime = Date.now();
  var process = child_process.exec(
    task.command, 
    { 
      cwd: task.repoPath,
      maxBuffer: 1024 * 1024 * 100,
      encoding: task._encoding,
      timeout: task._timeout
    },
    function (error, stdout, stderr) {
      git.runningTasks.splice(git.runningTasks.indexOf(task), 1);
      stdout = stdout.toString(); // Convert Buffers to strings
      stderr = stderr.toString();
      if (config.logGitOutput) winston.info('git result (first 400 bytes): ' + task.command + '\n' + stderr.slice(0, 400) + '\n' + stdout.slice(0, 400));
      if (error !== null) {
        var err = {};
        err.isGitError = true;
        err.errorCode = 'unknown';
        err.stackAtCall = task.potentialError.stack;
        err.lineAtCall = task.potentialError.lineNumber;
        err.command = task.command;
        err.workingDirectory = task.repoPath;
        err.error = error.toString();
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
        task.setResult(err);
        callback(err);
      }
      else {
        var result = task._parser ? task._parser(stdout, task.parseArgs) : stdout;
        task.setResult(null, result);
        callback();
      }
    });

  task.process = process;
  task.setStarted();
}, config.maxConcurrentGitOperations);

git.queueTask = function(task) {
  gitQueue.push(task);
}

git.status = function(repoPath, file) {
  var task = new GitTask();
  var gitTask = git('status -s -b -u ' + (file ? '"' + file + '"' : ''), repoPath)
    .parser(gitParser.parseGitStatus)
    .fail(task.setResult)
    .done(function(status) {
      // From http://stackoverflow.com/questions/3921409/how-to-know-if-there-is-a-git-rebase-in-progress
      status.inRebase = fs.existsSync(path.join(repoPath, '.git', 'rebase-merge')) ||
        fs.existsSync(path.join(repoPath, '.git', 'rebase-apply'));

      status.inMerge = fs.existsSync(path.join(repoPath, '.git', 'MERGE_HEAD'));

      if (status.inMerge) {
        status.commitMessage = fs.readFileSync(path.join(repoPath, '.git', 'MERGE_MSG'), { encoding: 'utf8' });
      }

      task.setResult(null, status);
    });
  task.started(gitTask.start);
  return task;
}

git.getRemoteAddress = function(repoPath, remoteName) {
  return git('config --get remote.' + remoteName + '.url', repoPath)
    .parser(function(text) {
      return addressParser.parseAddress(text.split('\n')[0]);
    });
}

git.stashAndPop = function(repoPath, wrappedTask) {
  var task = new GitTask();

  var gitTask = git('stash', repoPath)
    .always(function(err, res) {
      var hadLocalChanges = true;
      if (err) {
        if (err.stderr.indexOf('You do not have the initial commit yet') != -1) {
          hadLocalChanges = false;
        } else {
          task.setResult(err, res);
          return;
        }
      } else {
        if (res.indexOf('No local changes to save') != -1)
          hadLocalChanges = false;
      }
      if (hadLocalChanges) {
        var popTask = git('stash pop', repoPath).always(task.setResult);
        wrappedTask.always(function() { popTask.start(); });
      } else {
        wrappedTask.always(task.setResult);
      }
      wrappedTask.start();
    });
  task.started(gitTask.start);
  return task;
}

git.binaryFileContent = function(repoPath, filename, version) {
  return git('show ' + version + ':' + filename, repoPath)
        .encoding('binary');
}


git.diffFile = function(repoPath, filename, sha1, maxNLines) {
  var task = new GitTask();

  var statusTask = git.status(repoPath)
    .fail(task.setResult)
    .done(function(status) {
      var file = status.files[filename];
      var filePath = path.join(repoPath, filename);
      if (!file && !sha1) {
        if (fs.existsSync(path.join(repoPath, filename))) task.setResult(null, []);
        else task.setResult({ error: 'No such file: ' + filename, errorCode: 'no-such-file' });
        // If the file is new or if it's a directory, i.e. a submodule
      } else if (sha1 || !file.isNew || fs.lstatSync(filePath).isDirectory()) {
        var gitCommand;
        if (sha1) {
          gitCommand = 'diff ' + sha1  + (isWindows ? '^^' : '^') + '! -- "' + filename.trim() + '"';
        } else {
          gitCommand = 'diff HEAD -- "' + filename.trim() + '"';
        }
        git(gitCommand, repoPath)
          .parser(gitParser.parseGitDiff, { maxNLines: maxNLines })
          .always(task.setResult)
          .start();
      } else {
        fs.readFile(filePath, { encoding: 'utf8' }, function(err, text) {
          if (err) return task.setResult({ error: err });
          var diffs = [];
          var diff = { };
          text = text.toString();
          var lines = text.split('\n');
          diff.totalNumberOfLines = lines.length;
          if (maxNLines) lines = lines.slice(0, maxNLines);
          diff.lines = lines.map(function(line, i) { return [null, i, '+' + line]; });
          diffs.push(diff);
          task.setResult(null, diffs);
        });
      }
    });
  task.started(statusTask.start);

  return task;
}

git.discardAllChanges = function(repoPath) {
  var task = new GitTask();
  
  var gitTask = git('reset --hard HEAD', repoPath)
    .fail(task.setResult)
    .done(function() {
      git('clean -fd', repoPath).always(task.setResult).start();
    });
  task.started(gitTask.start);

  return task;
}

git.discardChangesInFile = function(repoPath, filename) {
  var task = new GitTask();

  var filePath = path.join(repoPath, filename);

  var statusTask = git.status(repoPath, filename)
    .fail(task.setResult)
    .done(function(status) {
      if (Object.keys(status.files).length == 0) throw new Error('No files in status in discard, filename: ' + filename);
      var fileStatus = status.files[Object.keys(status.files)[0]];

      if (!fileStatus.staged) {
        // If it's just a new file, remove it
        if (fileStatus.isNew) {
          fs.unlink(filePath, function(err) {
            if (err) task.setResult({ command: 'unlink', error: err });
            else task.setResult();
          });
        // If it's a changed file, reset the changes
        } else {
          git('checkout HEAD -- "' + filename.trim() + '"', repoPath)
            .always(task.setResult)
            .start();
        }
      } else {
        git('rm -f "' + filename + '"', repoPath).always(task.setResult).start();
      }
    });
  task.started(statusTask.start);

  return task;
}

git.updateIndexFromFileList = function(repoPath, files) {
  var task = new GitTask();

  var statusTask = git.status(repoPath)
    .fail(task.setResult)
    .done(function(status) {
      var toAdd = [];
      var toRemove = [];
      for(var v in files) {
        var file = files[v];
        var fileStatus = status.files[file] || status.files[path.relative(repoPath, file)];
        if (!fileStatus) {
          task.setResult({ error: 'No such file in staging: ' + file });
          return;
        }
        if (fileStatus.removed) toRemove.push(file);
        else toAdd.push(file);
      }

      async.series([
        function(done) {
          if (toAdd.length == 0) done();
          else {
            git('update-index --add --stdin', repoPath)
              .always(done)
              .started(function() {
                var filesToAdd = toAdd.map(function(file) { return file.trim(); }).join('\n');
                this.process.stdin.end(filesToAdd);
              })
              .start();
          }
        },
        function(done) {
          if (toRemove.length == 0) done();
          else {
            git('update-index --remove --stdin', repoPath)
              .always(done)
              .started(function() {
                var filesToRemove = toRemove.map(function(file) { return file.trim(); }).join('\n');
                this.process.stdin.end(filesToRemove);
              })
              .start();
          }
        }
      ], function(err) {
        if (err) return task.setResult(err);
        task.setResult();
      });

    });
  task.started(statusTask.start);

  return task;
}

git.commit = function(repoPath, amend, message, files) {
  var task = new GitTask();

  if (message === undefined)
    return task.setResult({ error: 'Must specify commit message' });

  if ((!(files instanceof Array) || files.length == 0) && !amend)
    return task.setResult({ error: 'Must specify files or amend to commit' });

  var updateIndexTask = git.updateIndexFromFileList(repoPath, files)
    .fail(task.setResult)
    .done(function() {
      git('commit ' + (amend ? '--amend' : '') + ' --file=- ', repoPath)
        .always(task.setResult)
        .started(function() {
          this.process.stdin.end(message);
        })
        .start();
    });
  task.started(updateIndexTask.start);

  return task;
}

git.resolveConflicts = function(repoPath, files) {
  var task = new GitTask();

  task.start = function() {
    var toAdd = [], toRemove = [];
    async.map(files, function(file, callback) {
      fs.exists(path.join(repoPath, file), function(exists) {
        if (exists) toAdd.push(file);
        else toRemove.push(file);
        callback();
      })
    }, function() {

      async.parallel([
        function(done) {
          if (toAdd.length == 0) return done();
          git('add ' + toAdd.map(function(file) { return '"' + file + '"'; }).join(' '), repoPath)
            .always(done)
            .start();
        },
        function(done) {
          if (toRemove.length == 0) return done();
          git('rm ' + toRemove.map(function(file) { return '"' + file + '"'; }).join(' '), repoPath)
            .always(done)
            .start();
        },
      ], function(err) {
        task.setResult(err);
      });

    });
    task.setStarted();
  }

  return task;
}

git.getCurrentBranch = function(repoPath) {
  var task = new GitTask();
  var gitTask = git('rev-parse --show-toplevel', repoPath)
    .fail(task.setResult)
    .done(function(rootRepoPath) {

      var HEADFile = path.join(rootRepoPath.trim(), '.git', 'HEAD');
      if (!fs.existsSync(HEADFile))
        return task.setResult({ errorCode: 'not-a-repository', error: 'No such file: ' + HEADFile });
      fs.readFile(HEADFile, { encoding: 'utf8' }, function(err, text) {
        if (err) return task.setResult(err);
        text = text.toString();
        var rows = text.split('\n');
        var branch = rows[0].slice('ref: refs/heads/'.length);
        task.setResult(null, branch);
      });
    });
  task.started(gitTask.start);
  return task;
}

module.exports = git;
