
var ko = require('knockout');
var ProgressBarViewModel = require('./controls').ProgressBarViewModel;
var RepositoryViewModel = require('./repository').RepositoryViewModel;
var addressParser = require('../../source/address-parser');
var signals = require('signals');

function HomeRepositoryViewModel(home, path) {
  this.home = home;
  this.app = home.app;
  this.path = path;
  this.title = path;
  this.link = '/#/repository?path=' + encodeURIComponent(path);
  this.pathRemoved = ko.observable(false);
  this.remote = ko.observable('...');
  this.updateState();
}
HomeRepositoryViewModel.prototype.updateState = function() {
  var self = this;
  this.app.get('/fs/exists?path=' + encodeURIComponent(this.path), undefined, function(err, exists) {
    self.pathRemoved(!exists);
  });
  this.app.get('/remotes/origin?path=' + encodeURIComponent(this.path), undefined, function(err, remote) {
    if (err) {
      self.remote('');
      return true;
    }
    self.remote(remote.address);
  });
}
HomeRepositoryViewModel.prototype.remove = function() {
  var repos = this.app.repoList();
  var i;
  while((i = repos.indexOf(this.path)) != -1)
    repos.splice(i, 1);
  this.app.repoList(repos);
  this.home.update();
}

function HomeViewModel(app) {
  var self = this;
  this.app = app;
  this.repos = ko.observable([]);
  this.showNux = ko.computed(function() {
    return self.repos().length == 0;
  });
}
exports.HomeViewModel = HomeViewModel;
HomeViewModel.prototype.template = 'home';
HomeViewModel.prototype.shown = function() {
  this.update();
}
HomeViewModel.prototype.update = function() {
  var self = this;
  var reposByPath = {};
  this.repos().forEach(function(repo) { reposByPath[repo.path] = repo; });
  this.repos(this.app.repoList().sort().map(function(path) {
    if (!reposByPath[path])
      reposByPath[path] = new HomeRepositoryViewModel(self, path);
    return reposByPath[path];
  }));
}


var CrashViewModel = function() {
}
exports.CrashViewModel = CrashViewModel;
CrashViewModel.prototype.template = 'crash';


var UserErrorViewModel = function(args) {
  if (typeof(arguments[0]) == 'string')
    args = { title: arguments[0], details: arguments[1] };
  args = args || {};
  this.title = ko.observable(args.title);
  this.details = ko.observable(args.details);
}
exports.UserErrorViewModel = UserErrorViewModel;
UserErrorViewModel.prototype.template = 'usererror';


var PathViewModel = function(app, path) {
  var self = this;
  this.app = app;
  this.path = path;
  this.status = ko.observable('loading');
  this.loadingProgressBar = new ProgressBarViewModel('path-loading-' + path);
  this.loadingProgressBar.start();
  this.cloningProgressBar = new ProgressBarViewModel('path-loading-' + path, 10000);
  this.cloneUrl = ko.observable();
  this.unitiedPathTitle = ko.observable();
  this.cloneDestinationImplicit = ko.computed(function() {
    var defaultText = 'destination folder';
    if (!self.cloneUrl()) return defaultText;

    var parsedAddress = addressParser.parseAddress(self.cloneUrl());
    return parsedAddress.shortProject || defaultText;
  });
  this.cloneDestination = ko.observable();
  this.repository = ko.observable();
}
exports.PathViewModel = PathViewModel;
PathViewModel.prototype.template = 'path';
PathViewModel.prototype.shown = function() {
  this.updateStatus();
}
PathViewModel.prototype.updateAnimationFrame = function(deltaT) {
  if (this.repository())
    this.repository().updateAnimationFrame(deltaT);
}
PathViewModel.prototype.updateStatus = function() {
  var self = this;
  self.unitiedPathTitle('Not a repository');
  this.app.get('/quickstatus', { path: this.path }, function(err, status){
    self.loadingProgressBar.stop();
    if (err) return;
    if (status == 'inited') {
      self.status('repository');
      self.repository(new RepositoryViewModel(self.app, self.path));
    } else if (status == 'uninited') {
      self.status('uninited');
    } else if (status == 'no-such-path') {
      self.status('invalidpath');
    }
  });
}
PathViewModel.prototype.initRepository = function() {
  var self = this;
  this.app.post('/init', { path: this.path }, function(err, res) {
    if (err) return;
    self.updateStatus();
  });
}
PathViewModel.prototype.cloneRepository = function() {
  var self = this;
  self.status('cloning');
  this.cloningProgressBar.start();
  var dest = this.cloneDestination() || this.cloneDestinationImplicit();

  var programEventListener = function(event) {
    if (event.event == 'credentialsRequested') self.cloningProgressBar.pause();
    else if (event.event == 'credentialsProvided') self.cloningProgressBar.unpause();
  };
  this.app.programEvents.add(programEventListener);

  this.app.post('/clone', { path: this.path, url: this.cloneUrl(), destinationDir: dest }, function(err, res) {
    self.app.programEvents.remove(programEventListener);
    self.cloningProgressBar.stop();
    if (err) return;
    self.app.browseTo('repository?path=' + encodeURIComponent(res.path));
  });
}
PathViewModel.prototype.createDir = function() {
  var self = this;
  self.unitiedPathTitle('Directory created');
  this.app.post('/createDir',  {dir: this.path }, function() {
    self.status('uninited');
  });
}
PathViewModel.prototype.refreshContent = function(callback) {
  if (this.repository()) this.repository().refreshContent(callback);
  else callback();
}

var LoginViewModel = function(app) {
  var self = this;
  this.app = app;
  this.loggedIn = new signals.Signal();
  this.status = ko.observable('loading');
  this.username = ko.observable();
  this.password = ko.observable();
  this.loginError = ko.observable();
  this.app.get('/loggedin', undefined, function(err, status) {
    if (status.loggedIn) {
      self.loggedIn.dispatch();
      self.status('loggedIn');
    }
    else self.status('login');
  });
}
exports.LoginViewModel = LoginViewModel;
LoginViewModel.prototype.login = function() {
  var self = this;
  this.app.post('/login', { username: this.username(), password: this.password() }, function(err, res) {
    if (err) {
      if (err.res.body.error) {
        self.loginError(err.res.body.error);
        return true;
      }
    } else {
      self.loggedIn.dispatch();
      self.status('loggedIn');
    }
  });
}
LoginViewModel.prototype.template = 'login';
