
var ko = require('knockout');
var ProgressBarViewModel = require('./controls').ProgressBarViewModel;
var GitGraphViewModel = require('./git-graph').GitGraphViewModel;
var async = require('async');
var StagingViewModel = require('./staging').StagingViewModel;
var dialogs = require('./dialogs');
var _ = require('lodash');
var StashViewModel = require('./stash');
var components = require('./components');

var idCounter = 0;
var newId = function() { return idCounter++; };


var RepositoryViewModel = function(app, repoPath) {
  var self = this;

  this.app = app;
  this.repoPath = repoPath;
  this.graph = new GitGraphViewModel(this);
  this.remotes = components.create('remotes', { repositoryViewModel: this });
  this.stash = new StashViewModel(this);
  this.staging = new StagingViewModel(this);
  this.watcherReady = ko.observable(false);
  this.showLog = ko.computed(function() {
    return !self.staging.inRebase() && !self.staging.inMerge();
  });
  app.watchRepository(repoPath, function() { self.watcherReady(true); });

  self.onWorkingTreeChanged();
  self.onGitDirectoryChanged();
}
exports.RepositoryViewModel = RepositoryViewModel;
RepositoryViewModel.prototype.onWorkingTreeChanged = function() {
  this.staging.refreshContent();
  this.staging.invalidateFilesDiffs();
}
RepositoryViewModel.prototype.onGitDirectoryChanged = function() {
  this.stash.refresh();
  this.graph.loadNodesFromApi();
  this.graph.updateBranches();
  this.remotes.updateRemotes();
}
RepositoryViewModel.prototype.refreshContent = function(callback) {
  async.parallel([
    this.staging.refreshContent.bind(this.staging),
    this.graph.loadNodesFromApi.bind(this.graph)
  ], callback);
}
RepositoryViewModel.prototype.updateAnimationFrame = function(deltaT) {
  this.graph.updateAnimationFrame(deltaT);
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

