
var ko = require('knockout');
var components = require('ungit-components');
var async = require('async');
var _ = require('lodash');

components.register('repository', function(args) {
  return new RepositoryViewModel(args.server, args.repoPath);
});

var idCounter = 0;
var newId = function() { return idCounter++; };

var RepositoryViewModel = function(server, repoPath) {
  var self = this;

  this.server = server;
  this.repoPath = repoPath;
  this.graph = components.create('graph', { repositoryViewModel: this });
  this.remotes = components.create('remotes', { repositoryViewModel: this });
  this.stash = components.create('stash', { server: server, repoPath: repoPath });
  this.staging = components.create('staging', { server: server, repoPath: repoPath });
  this.watcherReady = ko.observable(false);
  this.showLog = ko.computed(function() {
    return !self.staging.inRebase() && !self.staging.inMerge();
  });
  this.server.watchRepository(repoPath, function() { self.watcherReady(true); });

  self.onWorkingTreeChanged();
  self.onGitDirectoryChanged();
}
RepositoryViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('repository', this, {}, parentElement);
}
exports.RepositoryViewModel = RepositoryViewModel;
RepositoryViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'working-tree-changed') this.onWorkingTreeChanged();
  else if (event.event == 'git-directory-changed') this.onGitDirectoryChanged();
  if (this.graph.onProgramEvent) this.graph.onProgramEvent(event);
  if (this.staging.onProgramEvent) this.staging.onProgramEvent(event);
}
RepositoryViewModel.prototype.onWorkingTreeChanged = function() {
  this.staging.refreshContent();
  this.staging.invalidateFilesDiffs();
}
RepositoryViewModel.prototype.onGitDirectoryChanged = function() {
  this.stash.refresh();
  this.remotes.updateRemotes();
}
RepositoryViewModel.prototype.updateAnimationFrame = function(deltaT) {
  if (this.graph.updateAnimationFrame) this.graph.updateAnimationFrame(deltaT);
}


 
