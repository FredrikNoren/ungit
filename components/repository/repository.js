
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
RepositoryViewModel.prototype.handleBubbledClick = function(elem, event) {
  // If the clicked element is bound to the current action context,
  // then let's not deselect it.
  if (ko.dataFor(event.target) === this.graph.currentActionContext()) return;
  this.graph.currentActionContext(null);
  // If the click was on an input element, then let's allow the default action to proceed.
  // This is especially needed since for some strange reason any submit (ie. enter in a textbox)
  // will trigger a click event on the submit input of the form, which will end up here,
  // and if we don't return true, then the submit event is never fired, breaking stuff.
  if (event.target.nodeName === 'INPUT') return true;
}


 
