var child_process = require('child_process');
var express = require('express');
var fs = require('fs');
var path = require('path');
var temp = require('temp');
var async=  require('async');
var git = require('./git');
var gitParser = require('./git-parser');
var winston = require('winston');
var usageStatistics = require('./usage-statistics');
var os = require('os');
var mkdirp = require('mkdirp');
var pathHelper = require('./utils/path-helper.js');

exports.pathPrefix = '';
var imageFileExtensions = ['.PNG', '.JPG', '.BMP', '.GIF'];

exports.registerApi = function(env) {
  var app = env.app;
  var server = env.server;
  var ensureAuthenticated = env.ensureAuthenticated || function(req, res, next) { next(); };
  var ensurePathExists = env.ensurePathExists || function(req, res, next) { next(); };
  var config = env.config;
  var io = env.socketIO;
  var socketsById = env.socketsById || {};

  if (config.dev)
    temp.track();

  app.use(express.json());
  app.use(express.urlencoded());

  if (io) {
    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function () {
        if (socket.watcher) {
          socket.watcher.close();
          socket.watcher = null;
          winston.info('Stop watching ' + socket.watcherPath);
        }
      });
      socket.on('watch', function (data, callback) {
        if (socket.watcher) {
          socket.leave(socket.watcherPath);
          socket.watcher.close(); // only one watcher per socket
          winston.info('Stop watching ' + socket.watcherPath);
        }
        socket.join(path.normalize(data.path)); // join room for this path
        socket.watcherPath = data.path;
        try {
          socket.watcher = fs.watch(data.path, function(event, filename) {
            // The .git dir changes on for instance 'git status', so we
            // can't trigger a change here (since that would lead to an endless
            // loop of the client getting the change and then requesting the new data)
            if (!filename || (filename != '.git' && filename.indexOf('.git/') != 0))
              socket.emit('working-tree-changed', { repository: data.path });
          });
          winston.info('Start watching ' + socket.watcherPath);
        } catch(err) {
          // Sometimes fs.watch crashes with errors such as ENOSPC (no space available)
          // which is pretty weird, but hard to do anything about, so we just log them here.
          usageStatistics.addEvent('fs-watch-exception');
        }
        if (callback) callback();
      });
    });
  }

  var ensureValidSocketId = function(req, res, next) {
    var socketId = req.param('socketId');
    if (socketId == 'ignore') return next(); // Used in unit tests
    var socket = socketsById[socketId];
    if (!socket) {
      res.json(400, { error: 'No such socket: ' + socketId, errorCode: 'invalid-socket-id' });
    } else {
      next();
    }
  }

  var emitWorkingTreeChanged = function(repoPath) {
    if (io) {
      io.sockets.in(path.normalize(repoPath)).emit('working-tree-changed', { repository: repoPath });
      winston.info('emitting working-tree-changed to sockets, manually triggered');
    }
  }
  var emitGitDirectoryChanged = function(repoPath) {
    repoPath = pathHelper.strip_restriction(repoPath);
    if (io) {
      io.sockets.in(path.normalize(repoPath)).emit('git-directory-changed', { repository: repoPath });
      winston.info('emitting git-directory-changed to sockets, manually triggered');
    }
  }

  var jsonFail = function(res, err) {
    res.json(400, err);
  }

  var jsonResultOrFail = function(res, err, result) {
    if (err) res.json(400, err);
    else res.json(result || {});
  }

  function credentialsOption(socketId) {
    var credentialsHelperPath = path.resolve(__dirname, '..', 'bin', 'credentials-helper').replace(/\\/g, '/');
    return '-c credential.helper="' + credentialsHelperPath + ' ' + socketId + ' ' + config.port + '" ';
  }

  app.get(exports.pathPrefix + '/status', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git.status(repoPath)
      .always(function(err, result) {
        if(result) {
          for(var file in result.files) {
            result.files[file].type = imageFileExtensions.indexOf(path.extname(file).toUpperCase()) != -1 ? 'image' : 'text';
          }
        }
        jsonResultOrFail(res, err, result);
      });
  });

  app.post(exports.pathPrefix + '/init', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git('init' + (req.param('bare') ? ' --bare --shared' : ''), repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/clone', ensureAuthenticated, ensurePathExists, ensureValidSocketId, function(req, res) {
    // Default timeout is 2min but clone can take much longer than that (allows up to 2h)
    var timeoutMs = 2 * 60 * 60 * 1000;
    if (res.setTimeout) res.setTimeout(timeoutMs);

    var url = req.body.url.trim();
    if (url.indexOf('git clone ') == 0) url = url.slice('git clone '.length);
    var repoPath = pathHelper.restrict(req.param('path'));
    git(credentialsOption(req.param('socketId')) + ' clone "' + url + '" ' + '"' + req.param('destinationDir').trim() + '"', repoPath)
      .timeout(timeoutMs)
      .fail(jsonFail.bind(null, res))
      .done(function(result) { res.json({ path: path.resolve(repoPath, req.param('destinationDir')) }); })
      .always(emitGitDirectoryChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/fetch', ensureAuthenticated, ensurePathExists, ensureValidSocketId, function(req, res) {
    // Allow a little longer timeout on fetch (10min)
    var timeoutMs = 10 * 60 * 1000;
    if (res.setTimeout) res.setTimeout(timeoutMs);

    var repoPath = pathHelper.restrict(req.param('path'));
    git(credentialsOption(req.param('socketId')) + ' fetch ' + req.param('remote') + ' ' + 
        (req.param('ref') ? req.param('ref') : '') + (config.autoPruneOnFetch ? ' --prune' : ''),
        repoPath)
      .timeout(10 * 60 * 1000)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/push', ensureAuthenticated, ensurePathExists, ensureValidSocketId, function(req, res) {
    // Allow a little longer timeout on push (10min)
    var timeoutMs = 10 * 60 * 1000;
    if (res.setTimeout) res.setTimeout(timeoutMs);

    var repoPath = pathHelper.restrict(req.param('path'));
    git(credentialsOption(req.param('socketId')) + ' push ' + (req.param('force') ? ' -f ' : '') + req.param('remote') + ' ' + (req.body.refSpec ? req.body.refSpec : 'HEAD') +
      (req.body.remoteBranch ? ':' + req.body.remoteBranch : ''), repoPath)
      .timeout(10 * 60 * 1000)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/reset', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git.stashAndPop(repoPath, git('reset --' + req.param('mode') + ' "' + req.body.to + '"', repoPath, false))
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.get(exports.pathPrefix + '/diff', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git.diffFile(repoPath, req.param('file'))
      .always(jsonResultOrFail.bind(null, res));
  });

  app.get(exports.pathPrefix + '/diff/image', ensureAuthenticated, ensurePathExists, function(req, res) {
    if (req.query.version == 'previous') {
      git.binaryFileContentAtHead(req.query.path, req.query.filename)
        .always(function(err, result) {
          res.type(path.extname(req.query.filename));
          if (err) res.json(400, err); 
          else res.send(new Buffer(result, 'binary'));
        });
    } else {
      res.sendfile(path.join(req.query.path, req.query.filename));
    }
  });

  app.post(exports.pathPrefix + '/discardchanges', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    var task;
    if (req.param('all')) task = git.discardAllChanges(repoPath);
    else task = git.discardChangesInFile(repoPath, req.param('file').trim());

    task
      .always(jsonResultOrFail.bind(null, res))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/ignorefile', ensureAuthenticated, ensurePathExists, function(req, res){
    var currentPath = pathHelper.restrict(req.param('path').trim());
    var gitIgnoreFile = currentPath + '/.gitignore';
    var ignoreFile = req.param('file').trim();
    var socket = socketsById[req.param('socketId')];

    if (!fs.existsSync(gitIgnoreFile)) fs.writeFileSync(gitIgnoreFile, '');

    fs.readFile(gitIgnoreFile, function(err, data) { 

      var arrayOfLines = data.toString().match(/[^\r\n]+/g);
      if(arrayOfLines != null){
        for (var n = 0; n < arrayOfLines.length; n++) {
          if (arrayOfLines[n].trim() == ignoreFile) {
            return res.json(400, { errorCode: 'file-already-git-ignored', error: ignoreFile + ' already exist in .gitignore' });
          }
        }
      }

      fs.appendFile(gitIgnoreFile, os.EOL + ignoreFile, function(err) {
        if(err) {
          return res.json(400, { errorCode: 'error-appending-ignore', error: 'Error while appending to .gitignore file.' });
        } else {
          if(socket)
            socket.emit('working-tree-changed', { repository: currentPath });
          return res.json({});
        }
      }); 
    });
  });

  app.post(exports.pathPrefix + '/commit', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git.commit(repoPath, req.param('amend'), req.param('message'), req.param('files'),(config.authors && config.authors[req.user] ? config.authors[req.user] : undefined))
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/revert', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git('revert ' + req.param('commit'), repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.get(exports.pathPrefix + '/log', ensureAuthenticated, ensurePathExists, function(req, res){
    var limit = '';
    if (req.query.limit) limit = '--max-count=' + req.query.limit;
    var repoPath = pathHelper.restrict(req.param('path'));
    git('log --decorate=full --pretty=fuller --all --parents ' + limit, repoPath)
      .parser(gitParser.parseGitLog)
      .always(function(err, log) {
        if (err) {
          if (err.stderr.indexOf('fatal: bad default revision \'HEAD\'') == 0)
            res.json([]);
          else if (err.stderr.indexOf('fatal: Not a git repository') == 0)
            res.json([]);
          else
            res.json(400, err);
        } else {
          res.json(log);
        }
      });
  });

  app.get(exports.pathPrefix + '/branches', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git('branch', repoPath)
      .parser(gitParser.parseGitBranches)
      .always(jsonResultOrFail.bind(null, res));
  });

  app.post(exports.pathPrefix + '/branches', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git('branch ' + (req.body.force ? '-f' : '') + ' "' + req.body.name.trim() +
      '" "' + (req.body.startPoint || 'HEAD').trim() + '"', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath));
  });

  app.del(exports.pathPrefix + '/branches', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git('branch -D "' + req.param('name').trim() + '"', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath));
  });

  app.del(exports.pathPrefix + '/remote/branches', ensureAuthenticated, ensurePathExists, ensureValidSocketId, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git(credentialsOption(req.param('socketId')) + ' push ' + req.param('remote') + ' :"' + req.param('name').trim() + '"', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath));
  });

  app.get(exports.pathPrefix + '/tags', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git('tag -l', repoPath)
      .parser(gitParser.parseGitTags)
      .always(jsonResultOrFail.bind(null, res));
  });

  app.get(exports.pathPrefix + '/remote/tags', ensureAuthenticated, ensurePathExists, ensureValidSocketId, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git(credentialsOption(req.param('socketId')) + ' ls-remote --tags ' + req.param('remote'), repoPath)
      .parser(gitParser.parseGitLsRemote)
      .always(function(err, result) {
        if (err) return res.json(400, err);
        result.forEach(function(r) { r.remote = req.param('remote'); });
        res.json(result);
      });
  });

  app.post(exports.pathPrefix + '/tags', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git('tag ' + (req.body.force ? '-f' : '') + ' -a "' + req.body.name.trim() + '" -m "' +
      req.body.name.trim() + '" "' + (req.body.startPoint || 'HEAD').trim() + '"', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath));
  });

  app.del(exports.pathPrefix + '/tags', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git('tag -d "' + req.param('name').trim() + '"', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath));
  });
  
  app.del(exports.pathPrefix + '/remote/tags', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git(credentialsOption(req.param('socketId')) + ' push ' + req.param('remote') + ' :"refs/tags/' + req.param('name').trim() + '"', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/checkout', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git.stashAndPop(repoPath, git('checkout "' + req.body.name.trim() + '"', repoPath, false))
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/cherrypick', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git.stashAndPop(repoPath, git('cherry-pick "' + req.param('name').trim() + '"', repoPath, false))
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.get(exports.pathPrefix + '/checkout', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    var HEADFile = path.join(repoPath, '.git', 'HEAD');
    if (!fs.existsSync(HEADFile)) 
      return res.json(400, { errorCode: 'not-a-repository', error: 'No such file: ' + HEADFile });
    fs.readFile(HEADFile, { encoding: 'utf8' }, function(err, text) {
      if (err) res.json(400, err);
      text = text.toString();
      var rows = text.split('\n');
      var branch = rows[0].slice('ref: refs/heads/'.length);
      res.json(branch);
    });
  });

  app.get(exports.pathPrefix + '/remotes', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git('remote', repoPath)
      .parser(gitParser.parseGitRemotes)
      .always(jsonResultOrFail.bind(null, res));
  });

  app.get(exports.pathPrefix + '/remotes/:name', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git.getRemoteAddress(repoPath, req.params.name)
      .always(jsonResultOrFail.bind(null, res));
  });

  app.post(exports.pathPrefix + '/remotes/:name', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git('remote add ' + req.param('name') + ' ' + req.param('url'), repoPath)
      .always(jsonResultOrFail.bind(null, res));
  });

  app.post(exports.pathPrefix + '/merge', ensureAuthenticated, ensurePathExists, function(req, res) {
    var noFF = '';
    if (config.noFFMerge) noFF = '--no-ff';
    var repoPath = pathHelper.restrict(req.param('path'));
    git('merge ' + noFF +' "' + req.body.with.trim() + '"', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/merge/continue', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git('commit --file=- ', repoPath)
      .started(function(process) {
        process.stdin.end(req.param('message'));
      })
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/merge/abort', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git('merge --abort', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });


  app.post(exports.pathPrefix + '/rebase', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git('rebase "' + req.body.onto.trim() + '"', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/rebase/continue', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git('rebase --continue', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/rebase/abort', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git('rebase --abort', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/resolveconflicts', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git.resolveConflicts(repoPath, req.body.files)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.post(exports.pathPrefix + '/submodules', ensureAuthenticated, ensurePathExists, function(req, res) {
    var repoPath = pathHelper.restrict(req.param('path'));
    git('submodule add "' + req.body.submoduleUrl.trim() + '" "' + req.body.submodulePath.trim() + '"', repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.get(exports.pathPrefix + '/quickstatus', ensureAuthenticated, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    fs.exists(repoPath, function(exists) {
      if (!exists) {
        res.json('no-such-path');
        return;
      }

      git('rev-parse --is-inside-work-tree', repoPath)
        .always(function(err, result) {
          if (err || result.toString().indexOf('true') == -1) res.json('uninited');
          else res.json('inited');
        });
    })
  });

  app.get(exports.pathPrefix + '/stashes', ensureAuthenticated, ensurePathExists, function(req, res){
    var repoPath = pathHelper.restrict(req.param('path'));
    git('stash list --decorate=full --pretty=fuller', repoPath)
      .parser(gitParser.parseGitLog)
      .always(function(err, items) {
        if (err) return res.json(400, err);
        res.json(items.map(function(item, index) {
          return {
            id: index,
            name: item.reflogName.slice('refs/'.length),
            title: item.message,
            date: item.commitDate
          }
        }));
      });
  });

  app.post(exports.pathPrefix + '/stashes', ensureAuthenticated, ensurePathExists, function(req, res){
    var message = '';
    if (req.param('message')) message = req.param('message');
    var repoPath = pathHelper.restrict(req.param('path'));
    git('stash save --include-untracked ' + message, repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.del(exports.pathPrefix + '/stashes/:id', ensureAuthenticated, ensurePathExists, function(req, res){
    var type = 'drop';
    if (req.query.pop === 'true') type = 'pop';
    var repoPath = pathHelper.restrict(req.param('path'));
    git('stash ' + type +' stash@{' + req.param('id') + '}' , repoPath)
      .always(jsonResultOrFail.bind(null, res))
      .always(emitGitDirectoryChanged.bind(null, repoPath))
      .always(emitWorkingTreeChanged.bind(null, repoPath));
  });

  app.get(exports.pathPrefix + '/gitconfig', ensureAuthenticated, function(req, res){
    git('config --list')
      .parser(gitParser.parseGitConfig)
      .always(jsonResultOrFail.bind(null, res));
  });

  // This method isn't called by the client but by credentials-helper.js
  app.get(exports.pathPrefix + '/credentials', function(req, res) {
    // this endpoint can only be invoked from localhost, since the credentials-helper is always
    // on the same machine that we're running ungit on
    if (req.ip != '127.0.0.1') {
      winston.info('Trying to get credentials from unathorized ip: ' + req.ip);
      res.json(400, { errorCode: 'request-from-unathorized-location' });
      return;
    }
    var socket = socketsById[req.param('socketId')];
    if (!socket) {
      // We're using the socket to display an authentication dialog in the ui,
      // so if the socket is closed/unavailable we pretty much can't get the username/password.
      winston.info('Trying to get credentials from unavailable socket: ' + req.param('socketId'));
      res.json(400, { errorCode: 'socket-unavailable' });
    } else {
      socket.once('credentials', function(data) {
        res.json(data);
      });
      socket.emit('request-credentials');
    }
  });

  app.post(exports.pathPrefix + '/createdir', ensureAuthenticated, function(req, res) {
    var dir = req.param('dir');
    if (!dir) {
      return res.json(400, { errorCode: 'missing-request-parameter', error: 'You need to supply the path request parameter' });
    }

    mkdirp(dir, function(err) {
      if (err) return res.json(400, err);
      else return res.json({});
    });
  });

  app.get(exports.pathPrefix + '/debug', ensureAuthenticated, function(req, res) {
    res.json({
      runningGitTasks: git.runningTasks.map(function(task) {
        return {
          path: task.repoPath,
          command: task.command,
          runningTime: (Date.now() - task.startTime) / 1000
        };
      })
    });
  });

  if (config.dev) {

    app.post(exports.pathPrefix + '/testing/createtempdir', ensureAuthenticated, function(req, res){
      temp.mkdir('test-temp-dir', function(err, path) {
        res.json({ path: path });
      });
    });
    app.post(exports.pathPrefix + '/testing/createfile', ensureAuthenticated, function(req, res){
      var content = req.body.content;
      if (req.body.content === undefined) content = ('test content\n' + Math.random() + '\n');
      fs.writeFileSync(req.param('file'), content);
      res.json({ });
    });
    app.post(exports.pathPrefix + '/testing/changefile', ensureAuthenticated, function(req, res){
      var content = req.param('content');
      if (content === undefined) content = ('test content\n' + Math.random() + '\n');
      fs.writeFileSync(req.param('file'), content);
      res.json({ });
    });
    app.post(exports.pathPrefix + '/testing/createimagefile', ensureAuthenticated, function(req, res){
      fs.writeFile(req.param('file'), 'png', {encoding: 'binary'});
      res.json({ });
    });
    app.post(exports.pathPrefix + '/testing/changeimagefile', ensureAuthenticated, function(req, res){
      fs.writeFile(req.param('file'), 'png ~~', {encoding: 'binary'});
      res.json({ });
    });
    app.post(exports.pathPrefix + '/testing/removefile', ensureAuthenticated, function(req, res){
      fs.unlinkSync(req.param('file'));
      res.json({ });
    });
    app.post(exports.pathPrefix + '/testing/git', ensureAuthenticated, function(req, res){
      git(req.param('command'), req.param('repo'))
        .always(jsonResultOrFail.bind(null, res));
    });
    app.post(exports.pathPrefix + '/testing/cleanup', ensureAuthenticated, function(req, res){
      var cleaned = temp.cleanup();
      //winston.info('Cleaned up: ' + JSON.stringify(cleaned));
      res.json({ result: cleaned });
    });
    app.post(exports.pathPrefix + '/testing/shutdown', ensureAuthenticated, function(req, res){
      res.json({ });
      process.exit();
    });
  }

};
