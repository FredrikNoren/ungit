var child_process = require('child_process');
var gitParser = require('./git-parser');
var async = require('async');
var path = require('path');
var fs = require('fs');

var gitConfigNoColors = '-c color.ui=false';

var git = function(command, repoPath, res, parser, callback) {
  command = 'git ' + gitConfigNoColors + ' ' + command;
  return child_process.exec(command, { cwd: repoPath, maxBuffer: 1024 * 1024 * 10 },
    function (error, stdout, stderr) {
      if (error !== null) {
        var err = { errorCode: 'unkown', command: command, error: error.toString(), stderr: stderr, stdout: stdout };
        if (stderr.indexOf('Not a git repository') >= 0)
          err.errorCode = 'not-a-repository';
        else if (err.stderr.indexOf('Connection timed out') != -1)
          err.errorCode = 'remote-timeout';
        if (!callback || !callback(err, stdout))
          res.json(400, err);
      }
      else {
        if (callback) callback(null, parser ? parser(stdout) : stdout);
        else res.json(parser ? parser(stdout) : {});
      }
  });
}
git.status = function(repoPath, res, callback) {
  git('status -s -b -u', repoPath, res, gitParser.parseGitStatus, function(err, status) {
    if (err) {
      if (callback) return callback(err, status);
      else return false;
    }
    // From http://stackoverflow.com/questions/3921409/how-to-know-if-there-is-a-git-rebase-in-progress
    status.inRebase = fs.existsSync(path.join(repoPath, '.git', 'rebase-merge')) ||
      fs.existsSync(path.join(repoPath, '.git', 'rebase-apply'));

    if (callback) callback(null, status);
    else res.json(status);
  });
}
git.remoteShow = function(repoPath, remoteName, res, callback) {
  git('remote show ' + remoteName, repoPath, res, gitParser.parseGitRemoteShow, callback);
}
git.stashAndPop = function(repoPath, res, callback) {
  var hadLocalChanges = true;
  async.series([
    function(done) {
      git('stash', repoPath, res, undefined, function(err, res) {
        if (res.indexOf('No local changes to save') != -1) {
          hadLocalChanges = false;
          done();
          return true;
        }
        if (!err) {
          done();
          return true;
        }
      });
    },
    function(done) {
      callback(done);
    },
    function(done) {
      if(!hadLocalChanges) done(); 
      else git('stash pop', repoPath, res, undefined, done);
    },
  ], function(err) {
    if (err) res.json(400, err);
    else res.json({});
  });
}

module.exports = git;