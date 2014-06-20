
var ko = require('knockout');
var components = require('ungit-components');
var async = require('async');
var _ = require('lodash');

components.register('repository', function(args) {
  return new RepositoryViewModel(args.server, args.repoPath);
});

var RepositoryViewModel = function(server, repoPath) {
  var self = this;

  this.server = server;
  this.repoPath = repoPath;
  this.gitErrors = components.create('gitErrors', { server: server, repoPath: repoPath });
  this.graph = components.create('graph', { server: server, repoPath: repoPath });
  this.remotes = components.create('remotes', { server: server, repoPath: repoPath });
  this.stash = components.create('stash', { server: server, repoPath: repoPath });
  this.staging = components.create('staging', { server: server, repoPath: repoPath });
  this.showLog = ko.computed(function() {
    return !self.staging.inRebase() && !self.staging.inMerge();
  });
  this.server.watchRepository(repoPath);
}
RepositoryViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('repository', this, {}, parentElement);
}
RepositoryViewModel.prototype.onProgramEvent = function(event) {
  if (this.gitErrors.onProgramEvent) this.gitErrors.onProgramEvent(event);
  if (this.graph.onProgramEvent) this.graph.onProgramEvent(event);
  if (this.staging.onProgramEvent) this.staging.onProgramEvent(event);
  if (this.stash.onProgramEvent) this.stash.onProgramEvent(event);
  if (this.remotes.onProgramEvent) this.remotes.onProgramEvent(event);
}
RepositoryViewModel.prototype.updateAnimationFrame = function(deltaT) {
  if (this.graph.updateAnimationFrame) this.graph.updateAnimationFrame(deltaT);
}


 
