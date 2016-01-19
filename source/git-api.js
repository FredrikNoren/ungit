var path = require('path');
var temp = require('temp');
var gitParser = require('./git-parser');
var winston = require('winston');
var usageStatistics = require('./usage-statistics');
var os = require('os');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var _ = require('lodash');
var gitPromise = require('./git-promise');
var Promise = require('bluebird');
var fs = require('./utils/fs-async');

exports.pathPrefix = '';

exports.registerApi = function(env) {
  var app = env.app;
  var server = env.server;
  var ensureAuthenticated = env.ensureAuthenticated || function(req, res, next) { next(); };
  var config = env.config;
  var io = env.socketIO;
  var socketsById = env.socketsById || {};

  if (config.dev)
    temp.track();

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
        var workingTreeChanged = _.debounce(function() {
          socket.emit('working-tree-changed', { repository: data.path });
        }, 200);
        try {
          socket.watcher = fs.watch(data.path, function(event, filename) {
            // The .git dir changes on for instance 'git status', so we
            // can't trigger a change here (since that would lead to an endless
            // loop of the client getting the change and then requesting the new data)
            if (!filename || (filename != '.git' && filename.indexOf('.git/') != 0))
              workingTreeChanged();
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

  var ensurePathExists = function(req, res, next) {
    fs.isExists(req.query.path || req.body.path).then(function(isExists) {
      if (isExists) {
        next();
      } else {
        res.status(400).json({ error: 'No such path: ' + path, errorCode: 'no-such-path' });
      }
    });
  }

  var ensureValidSocketId = function(req, res, next) {
    var socketId = req.query.socketId || req.body.socketId;
    if (socketId == 'ignore') return next(); // Used in unit tests
    var socket = socketsById[socketId];
    if (!socket) {
      res.status(400).json({ error: 'No such socket: ' + socketId, errorCode: 'invalid-socket-id' });
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
    if (io) {
      io.sockets.in(path.normalize(repoPath)).emit('git-directory-changed', { repository: repoPath });
      winston.info('emitting git-directory-changed to sockets, manually triggered');
    }
  }

  function autoStashExecuteAndPop(commands, repoPath, allowedCodes, outPipe, inPipe, timeout) {
    if (config.autoStashAndPop) {
      return gitPromise.stashExecuteAndPop(commands, repoPath, allowedCodes, outPipe, inPipe, timeout);
    } else {
      return gitPromise(commands, repoPath, allowedCodes, outPipe, inPipe, timeout);
    }
  }

  var jsonResultOrFailProm = function(res, promise) {
    return promise.then(function(result) {
        res.json(result || {});
      }).catch(function(err) {
        res.status(400).json(err);
      });
  }

  function credentialsOption(socketId) {
    var credentialsHelperPath = path.resolve(__dirname, '..', 'bin', 'credentials-helper').replace(/\\/g, '/');
    return ['-c', 'credential.helper=' + [credentialsHelperPath, socketId, config.port].join(' ')];
  }

  app.get(exports.pathPrefix + '/status', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise.status(req.query.path, null));
  });

  app.post(exports.pathPrefix + '/init', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise(req.body.bare ? ['init', '--bare', '--shared'] : ['init'], req.body.path));
  });

  app.post(exports.pathPrefix + '/clone', ensureAuthenticated, ensurePathExists, ensureValidSocketId, function(req, res) {
    // Default timeout is 2min but clone can take much longer than that (allows up to 2h)
    var timeoutMs = 2 * 60 * 60 * 1000;
    if (res.setTimeout) res.setTimeout(timeoutMs);

    var url = req.body.url.trim();
    if (url.indexOf('git clone ') == 0) url = url.slice('git clone '.length);
    var task = gitPromise({
      commands: credentialsOption(req.body.socketId).concat(['clone', url, req.body.destinationDir.trim()]),
      repoPath: req.body.path,
      timeout: timeoutMs
    }).then(function() {
      return { path: path.resolve(req.body.path, req.body.destinationDir) };
    });

    jsonResultOrFailProm(res, task)
      .finally(emitGitDirectoryChanged.bind(null, req.body.path))
  });

  app.post(exports.pathPrefix + '/fetch', ensureAuthenticated, ensurePathExists, ensureValidSocketId, function(req, res) {
    // Allow a little longer timeout on fetch (10min)
    var timeoutMs = 10 * 60 * 1000;
    if (res.setTimeout) res.setTimeout(timeoutMs);

    var task = gitPromise({
      commands: credentialsOption(req.body.socketId).concat([
          'fetch',
          req.body.remote,
          req.body.ref ? req.body.ref : '',
          config.autoPruneOnFetch ? '--prune' : '']),
      repoPath: req.body.path,
      timeout: timeoutMs
    });

    jsonResultOrFailProm(res, task)
      .finally(emitGitDirectoryChanged.bind(null, req.body.path));
  });

  app.post(exports.pathPrefix + '/push', ensureAuthenticated, ensurePathExists, ensureValidSocketId, function(req, res) {
    // Allow a little longer timeout on push (10min)
    var timeoutMs = 10 * 60 * 1000;
    if (res.setTimeout) res.setTimeout(timeoutMs);
    var task = gitPromise({
      commands: credentialsOption(req.body.socketId).concat([
          'push',
          req.body.remote,
          (req.body.refSpec ? req.body.refSpec : 'HEAD') + (req.body.remoteBranch ? ':' + req.body.remoteBranch : ''),
          (req.body.force ? '-f' : '')]),
      repoPath: req.body.path,
      timeout: timeoutMs
    });

    jsonResultOrFailProm(res, task)
      .finally(emitGitDirectoryChanged.bind(null, req.body.path));
  });

  app.post(exports.pathPrefix + '/reset', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, autoStashExecuteAndPop(['reset', '--' + req.body.mode, req.body.to], req.body.path))
      .then(emitGitDirectoryChanged.bind(null, req.body.path))
      .then(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.get(exports.pathPrefix + '/diff', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise.diffFile(req.query.path, req.query.file, req.query.sha1));
  });

  app.get(exports.pathPrefix + '/diff/image', ensureAuthenticated, ensurePathExists, function(req, res) {
    res.type(path.extname(req.query.filename));
    if (req.query.version !== 'current') {
      gitPromise.binaryFileContent(req.query.path, req.query.filename, req.query.version, res);
    } else {
      res.sendFile(path.join(req.query.path, req.query.filename));
    }
  });

  app.post(exports.pathPrefix + '/discardchanges', ensureAuthenticated, ensurePathExists, function(req, res){
    var task = req.body.all ? gitPromise.discardAllChanges(req.body.path) : gitPromise.discardChangesInFile(req.body.path, req.body.file.trim());
    task.then(emitWorkingTreeChanged.bind(null, req.body.path));
    jsonResultOrFailProm(res, task);
  });

  app.post(exports.pathPrefix + '/ignorefile', ensureAuthenticated, ensurePathExists, function(req, res){
    var currentPath = req.body.path.trim();
    var gitIgnoreFile = currentPath + '/.gitignore';
    var ignoreFile = req.body.file.trim();
    var task = fs.appendFileAsync(gitIgnoreFile, os.EOL + ignoreFile).catch(function(err) {
      throw { errorCode: 'error-appending-ignore', error: 'Error while appending to .gitignore file.' };
    });

    jsonResultOrFailProm(res, task)
      .finally(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.post(exports.pathPrefix + '/commit', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise.commit(req.body.path, req.body.amend, req.body.message, req.body.files))
      .then(emitGitDirectoryChanged.bind(null, req.body.path))
      .then(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.post(exports.pathPrefix + '/revert', ensureAuthenticated, ensurePathExists, function(req, res){
    jsonResultOrFailProm(res, gitPromise(['revert', req.body.commit], req.body.path))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path))
      .finally(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.get(exports.pathPrefix + '/log', ensureAuthenticated, ensurePathExists, function(req, res){
    var limit = req.query.limit ? '--max-count=' + req.query.limit : '';
    var task = gitPromise(['log', '--decorate=full', '--date=default', '--pretty=fuller', '--branches', '--tags', '--remotes', '--parents', '--no-notes', '--numstat', '--date-order', limit], req.query.path);
    task = task.then(gitParser.parseGitLog).catch(function(err) {
      if (err.stderr.indexOf('fatal: bad default revision \'HEAD\'') == 0)
        return [];
      else if (/fatal: your current branch \'.+\' does not have any commits yet.*/.test(err.stderr))
        return [];
      else if (err.stderr.indexOf('fatal: Not a git repository') == 0)
        return [];
      else
        throw err;
    });
    jsonResultOrFailProm(res, task);
  });

  app.get(exports.pathPrefix + '/show', ensureAuthenticated, function(req, res){
    jsonResultOrFailProm(res, gitPromise(['show', '--numstat', req.query.sha1], req.query.path).then(gitParser.parseGitLog));
  });

  app.get(exports.pathPrefix + '/head', ensureAuthenticated, ensurePathExists, function(req, res){
    var task = gitPromise(['log', '--decorate=full', '--pretty=fuller', '--parents', '--max-count=1'], req.query.path)
      .then(gitParser.parseGitLog)
      .catch(function(err) {
        if (err.stderr.indexOf('fatal: bad default revision \'HEAD\'') == 0)
          return [];
        else if (/fatal: your current branch \'.+\' does not have any commits yet.*/.test(err.stderr))
          return [];
        else if (err.stderr.indexOf('fatal: Not a git repository') == 0)
          return [];
        throw err;
      });
    jsonResultOrFailProm(res, task);
  });

  app.get(exports.pathPrefix + '/branches', ensureAuthenticated, ensurePathExists, function(req, res){
    jsonResultOrFailProm(res, gitPromise(['branch'], req.query.path).then(gitParser.parseGitBranches));
  });

  app.post(exports.pathPrefix + '/branches', ensureAuthenticated, ensurePathExists, function(req, res){
    var commands = ['branch', (req.body.force ? '-f' : ''), req.body.name.trim(), (req.body.startPoint || 'HEAD').trim()];

    jsonResultOrFailProm(res, gitPromise(commands, req.body.path))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path));
  });

  app.delete(exports.pathPrefix + '/branches', ensureAuthenticated, ensurePathExists, function(req, res){
    jsonResultOrFailProm(res, gitPromise(['branch', '-D', req.query.name.trim()], req.query.path))
      .finally(emitGitDirectoryChanged.bind(null, req.query.path));
  });

  app.delete(exports.pathPrefix + '/remote/branches', ensureAuthenticated, ensurePathExists, ensureValidSocketId, function(req, res){
    var commands = credentialsOption(req.query.socketId).concat(['push', req.query.remote, ':' + req.query.name.trim()]);

    jsonResultOrFailProm(res, gitPromise(commands, req.query.path))
      .finally(emitGitDirectoryChanged.bind(null, req.query.path))
  });

  app.get(exports.pathPrefix + '/tags', ensureAuthenticated, ensurePathExists, function(req, res){
    var task = gitPromise(['tag', '-l'], req.query.path)
      .then(gitParser.parseGitTags);
    jsonResultOrFailProm(res, task);
  });

  app.get(exports.pathPrefix + '/remote/tags', ensureAuthenticated, ensurePathExists, ensureValidSocketId, function(req, res){
    var task = gitPromise(credentialsOption(req.query.socketId).concat(['ls-remote', '--tags', req.query.remote]), req.query.path)
      .then(gitParser.parseGitLsRemote)
      .then(function(result) {
        result.forEach(function(r) { r.remote = req.query.remote; });
        return result;
      });
    jsonResultOrFailProm(res, task);
  });

  app.post(exports.pathPrefix + '/tags', ensureAuthenticated, ensurePathExists, function(req, res){
    var commands = ['tag', (req.body.force ? '-f' : ''), '-a', req.body.name.trim(), '-m', req.body.name.trim(), (req.body.startPoint || 'HEAD').trim()];

    jsonResultOrFailProm(res, gitPromise(commands, req.body.path))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path));
  });

  app.delete(exports.pathPrefix + '/tags', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise(['tag', '-d', req.query.name.trim()], req.query.path))
      .finally(emitGitDirectoryChanged.bind(null, req.query.path));
  });

  app.delete(exports.pathPrefix + '/remote/tags', ensureAuthenticated, ensurePathExists, function(req, res) {
    var commands = credentialsOption(req.query.socketId).concat(['push', req.query.remote + ' :"refs/tags' + req.query.name.trim() + '"']);

    jsonResultOrFailProm(res, gitPromise(commands, req.query.path))
      .finally(emitGitDirectoryChanged.bind(null, req.query.path));
  });

  app.post(exports.pathPrefix + '/checkout', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, autoStashExecuteAndPop(['checkout', req.body.name.trim()], req.body.path))
      .then(emitGitDirectoryChanged.bind(null, req.body.path))
      .then(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.post(exports.pathPrefix + '/cherrypick', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, autoStashExecuteAndPop(['cherry-pick', req.body.name.trim()], req.body.path))
      .then(emitGitDirectoryChanged.bind(null, req.body.path))
      .then(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.get(exports.pathPrefix + '/checkout', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise.getCurrentBranch(req.query.path));
  });

  app.get(exports.pathPrefix + '/remotes', ensureAuthenticated, ensurePathExists, function(req, res){
    jsonResultOrFailProm(res, gitPromise(['remote'], req.query.path).then(gitParser.parseGitRemotes));
  });

  app.get(exports.pathPrefix + '/remotes/:name', ensureAuthenticated, ensurePathExists, function(req, res){
    jsonResultOrFailProm(res, gitPromise.getRemoteAddress(req.query.path, req.params.name));
  });

  app.post(exports.pathPrefix + '/remotes/:name', ensureAuthenticated, ensurePathExists, function(req, res){
    jsonResultOrFailProm(res, gitPromise(['remote', 'add', req.params.name, req.body.url], req.body.path));
  });

  app.delete(exports.pathPrefix + '/remotes/:name', ensureAuthenticated, ensurePathExists, function(req, res){
    jsonResultOrFailProm(res, gitPromise(['remote', 'remove', req.params.name], req.query.path));
  });

  app.post(exports.pathPrefix + '/merge', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise(['merge', config.noFFMerge ? '--no-ff' : '', req.body.with.trim()], req.body.path))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path))
      .finally(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.post(exports.pathPrefix + '/merge/continue', ensureAuthenticated, ensurePathExists, function(req, res) {
    var args = {
      commands: ['commit', '--file=-'],
      repoPath: req.body.path,
      inPipe: req.body.message
    };

    jsonResultOrFailProm(res, gitPromise(args))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path))
      .finally(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.post(exports.pathPrefix + '/merge/abort', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise(['merge', '--abort'], req.body.path))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path))
      .finally(emitWorkingTreeChanged.bind(null, req.body.path));
  });


  app.post(exports.pathPrefix + '/rebase', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise(['rebase', req.body.onto.trim()], req.body.path))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path))
      .finally(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.post(exports.pathPrefix + '/rebase/continue', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise(['rebase', '--continue'], req.body.path))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path))
      .finally(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.post(exports.pathPrefix + '/rebase/abort', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise(['rebase', '--abort'], req.body.path))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path))
      .finally(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.post(exports.pathPrefix + '/resolveconflicts', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise.resolveConflicts(req.body.path, req.body.files))
      .then(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.get(exports.pathPrefix + '/baserepopath', ensureAuthenticated, ensurePathExists, function(req, res){
    var currentPath = path.resolve(path.join(req.query.path, '..'));
    jsonResultOrFailProm(res, gitPromise(['rev-parse', '--show-toplevel'], currentPath).then(function(baseRepoPath) {
      return { path: path.resolve(baseRepoPath.trim()) };
    }));
  });

  app.get(exports.pathPrefix + '/submodules', ensureAuthenticated, ensurePathExists, function(req, res){
    var filename = path.join(req.query.path, '.gitmodules');

    var task = fs.isExists(filename).then(function(exists) {
      if (exists) {
        return fs.readFileAsync(filename, {encoding: 'utf8'})
          .catch(function() { return {} })
          .then(gitParser.parseGitSubmodule);
      } else {
        return {};
      }
    });
    jsonResultOrFailProm(res, task);
  });

  app.post(exports.pathPrefix + '/submodules/update', ensureAuthenticated, ensurePathExists, function(req, res){
    jsonResultOrFailProm(res, gitPromise(['submodule', 'init'], req.body.path)
      .then(gitPromise.bind(null, ['submodule', 'update'], req.body.path)));
  });

  app.post(exports.pathPrefix + '/submodules/add', ensureAuthenticated, ensurePathExists, function(req, res) {
    jsonResultOrFailProm(res, gitPromise(['submodule', 'add', req.body.submoduleUrl.trim(), req.body.submodulePath.trim()], req.body.path))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path))
      .finally(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.delete(exports.pathPrefix + '/submodules', ensureAuthenticated, ensurePathExists, function(req, res) {
    // -f is needed for the cases when added submodule change is not in the staging or committed
    var task = gitPromise(['submodule', 'deinit', "-f", req.query.submoduleName], req.query.path)
      .then(gitPromise.bind(null, ['rm', '-f', req.query.submoduleName], req.query.path))
      .then(function() {
        rimraf.sync(path.join(req.query.path, req.query.submodulePath));
        rimraf.sync(path.join(req.query.path, '.git', 'modules', req.query.submodulePath));
      });

    jsonResultOrFailProm(res, task);
  });

  app.get(exports.pathPrefix + '/quickstatus', ensureAuthenticated, function(req, res){
    var task = fs.isExists(req.query.path).then(function(exists) {
      if (exists) {
        return gitPromise(['rev-parse', '--is-inside-work-tree'], req.query.path)
          .catch(function(err) {
            return 'uninited';
          }).then(function(result) {
            if (result.toString().indexOf('true') == -1) return 'uninited';
            else return 'inited';
          });
      } else {
        return 'no-such-path';
      }
    });
    jsonResultOrFailProm(res, task);
  });

  app.get(exports.pathPrefix + '/stashes', ensureAuthenticated, ensurePathExists, function(req, res){
    var task = gitPromise(['stash', 'list', '--decorate=full', '--pretty=fuller'], req.query.path)
      .then(gitParser.parseGitLog)
      .then(function(items) {
        return items.map(function(item, index) {
          return {
            id: index,
            name: item.reflogName.slice('refs/'.length),
            title: item.message,
            date: item.commitDate
          }
        });
      });
    jsonResultOrFailProm(res, task);
  });

  app.post(exports.pathPrefix + '/stashes', ensureAuthenticated, ensurePathExists, function(req, res){
    jsonResultOrFailProm(res, gitPromise(['stash', 'save', '--include-untracked', req.body.message || '' ], req.body.path))
      .finally(emitGitDirectoryChanged.bind(null, req.body.path))
      .finally(emitWorkingTreeChanged.bind(null, req.body.path));
  });

  app.delete(exports.pathPrefix + '/stashes/:id', ensureAuthenticated, ensurePathExists, function(req, res){
    var type = req.query.pop === 'true' ? 'pop' : 'drop';
    jsonResultOrFailProm(res, gitPromise(['stash', type, 'stash@{' + req.params.id + '}'], req.query.path))
      .finally(emitGitDirectoryChanged.bind(null, req.query.path))
      .finally(emitWorkingTreeChanged.bind(null, req.query.path));
  });

  app.get(exports.pathPrefix + '/gitconfig', ensureAuthenticated, function(req, res){
    jsonResultOrFailProm(res, gitPromise(['config', '--list'])
      .then(gitParser.parseGitConfig));
  });

  // This method isn't called by the client but by credentials-helper.js
  app.get(exports.pathPrefix + '/credentials', function(req, res) {
    // this endpoint can only be invoked from localhost, since the credentials-helper is always
    // on the same machine that we're running ungit on
    if (req.ip != '127.0.0.1' && req.ip != '::ffff:127.0.0.1') {
      winston.info('Trying to get credentials from unathorized ip: ' + req.ip);
      res.status(400).json({ errorCode: 'request-from-unathorized-location' });
      return;
    }
    var socket = socketsById[req.query.socketId];
    if (!socket) {
      // We're using the socket to display an authentication dialog in the ui,
      // so if the socket is closed/unavailable we pretty much can't get the username/password.
      winston.info('Trying to get credentials from unavailable socket: ' + req.query.socketId);
      res.status(400).json({ errorCode: 'socket-unavailable' });
    } else {
      socket.once('credentials', function(data) {
        res.json(data);
      });
      socket.emit('request-credentials');
    }
  });

  app.post(exports.pathPrefix + '/createdir', ensureAuthenticated, function(req, res) {
    var dir = req.query.dir || req.body.dir;
    if (!dir) {
      return res.status(400).json({ errorCode: 'missing-request-parameter', error: 'You need to supply the path request parameter' });
    }

    mkdirp(dir, function(err) {
      if (err) return res.status(400).json(err);
      else return res.json({});
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
      fs.writeFileSync(req.body.file, content);
      res.json({ });
    });
    app.post(exports.pathPrefix + '/testing/changefile', ensureAuthenticated, function(req, res){
      var content = req.body.content;
      if (content === undefined) content = ('test content\n' + Math.random() + '\n');
      fs.writeFileSync(req.body.file, content);
      res.json({ });
    });
    app.post(exports.pathPrefix + '/testing/createimagefile', ensureAuthenticated, function(req, res){
      fs.writeFile(req.body.file, 'png', {encoding: 'binary'});
      res.json({ });
    });
    app.post(exports.pathPrefix + '/testing/changeimagefile', ensureAuthenticated, function(req, res){
      fs.writeFile(req.body.file, 'png ~~', {encoding: 'binary'});
      res.json({ });
    });
    app.post(exports.pathPrefix + '/testing/removefile', ensureAuthenticated, function(req, res){
      fs.unlinkSync(req.body.file);
      res.json({ });
    });
    app.post(exports.pathPrefix + '/testing/git', ensureAuthenticated, function(req, res){
      jsonResultOrFailProm(res, gitPromise(req.body.command, req.body.repo))
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
