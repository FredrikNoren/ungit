
var ko = require('knockout');
var components = require('ungit-components');
var navigation = require('ungit-navigation');

components.register('header', function(args) {
  return new HeaderViewModel(args.app);
});

function HeaderViewModel(app) {
  var self = this;
  this.app = app;
  this.showBackButton = ko.observable(false);
  this.path = this.app.path;
  this.currentVersion = ungit.version;
  this.showAddToRepoListButton = ko.computed(function() {
    return self.path() && self.app.repoList().indexOf(self.path()) == -1;
  });
  this.refreshingProgressBar = components.create('progressBar', { predictionMemoryKey: 'refreshing-content', temporary: true });
}
HeaderViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('header', this, {}, parentElement);
}
HeaderViewModel.prototype.submitPath = function() {
  navigation.browseTo('repository?path=' + encodeURIComponent(this.path()));
}
HeaderViewModel.prototype.addCurrentPathToRepoList = function() {
  var repoPath = this.path();
  var repos = this.repoList();
  if (repos.indexOf(repoPath) != -1) return;
  repos.push(repoPath);
  this.repoList(repos);
  return true;
}
HeaderViewModel.prototype.refresh = function() {
  var self = this;
  this.refreshingProgressBar.start();
  this.app.refresh(function() {
    self.refreshingProgressBar.stop();
  });
  return true;
}