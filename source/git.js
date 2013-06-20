var child_process = require('child_process');
var gitParser = require('./git-parser');
var async=  require('async');

var gitConfigNoColors = '-c color.ui=false';

var git = function(command, repoPath, res, parser, callback) {
  command = 'git ' + gitConfigNoColors + ' ' + command;
  return child_process.exec(command, { cwd: repoPath, maxBuffer: 1024 * 1024 * 10 },
    function (error, stdout, stderr) {
      if (error !== null) {
        var err = { errorCode: 'unkown', command: command, error: error.toString(), stderr: stderr, stdout: stdout };
        if (stderr.indexOf('Not a git repository') >= 0)
          err.errorCode = 'not-a-repository';
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
  git('status -s -b -u', repoPath, res, gitParser.parseGitStatus, callback);
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