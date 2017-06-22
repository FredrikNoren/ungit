
var ko = require('knockout');
var components = require('ungit-components');

components.register('home', function(args) {
  return new HomeViewModel(args.app);
});

function HomeRepositoryViewModel(home, path) {
  this.home = home;
  this.app = home.app;
  this.server = this.app.server;
  this.path = path;
  this.title = path;
  this.link = ungit.config.rootPath + '/#/repository?path=' + encodeURIComponent(path);
  this.pathRemoved = ko.observable(false);
  this.remote = ko.observable('...');
  this.updateState();
}
HomeRepositoryViewModel.prototype.updateState = function() {
  var self = this;
  this.server.getPromise('/fs/exists?path=' + encodeURIComponent(this.path))
    .then(function(exists) { self.pathRemoved(!exists); });
  this.server.getPromise('/remotes/origin?path=' + encodeURIComponent(this.path))
    .then(function(remote) {	self.remote(remote.address.replace(/\/\/.*?\@/, "//***@")); })
    .catch(function(err) { self.remote(''); });
}
HomeRepositoryViewModel.prototype.remove = function() {
  this.app.repoList.remove(this.path);
  this.home.update();
}

function HomeViewModel(app) {
  var self = this;
  this.app = app;
  this.repos = ko.observableArray();
  this.showNux = ko.computed(function() {
    return self.repos().length == 0;
  });
}
HomeViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('home', this, {}, parentElement);
}
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
