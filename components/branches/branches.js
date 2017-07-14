
var ko = require('knockout');
var _ = require('lodash');
var async = require('async');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');

components.register('branches', function(args) {
  return new BranchesViewModel(args.server, args.repoPath);
});

function BranchesViewModel(server, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.server = server;
  this.branches = ko.observableArray();
  this.fetchingProgressBar = components.create('progressBar', { predictionMemoryKey: 'fetching-' + this.repoPath(), temporary: true });
  this.current = ko.observable();
  this.fetchLabel = ko.computed(function() {
    if (self.current()) {
      return self.current();
    }
  });
  this.updateBranches();
}
BranchesViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('branches', this, {}, parentElement);
}
BranchesViewModel.prototype.clickFetch = function() { this.updateBranches(); }
BranchesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event === 'working-tree-changed' || event.event == 'request-app-content-refresh' || event.event == 'branch-updated') {
    this.updateBranches();
  }
}
BranchesViewModel.prototype.checkoutBranch = function(branch) {
  var self = this;
  this.fetchingProgressBar.start();
  this.server.postPromise('/checkout', { path: this.repoPath(), name: branch.name })
    .then(function() { self.current(branch.name); })
    .finally(function() { self.fetchingProgressBar.stop(); });
}
BranchesViewModel.prototype.updateBranches = function() {
  var self = this;
  this.fetchingProgressBar.start();

  this.server.getPromise('/branches', { path: this.repoPath() })
    .then(function(branches) {
      var sorted = branches.sort(function(a, b) {
        if (a.name < b.name)
           return -1;
        if (a.name > b.name)
          return 1;
        return 0;
      });
      self.branches(sorted);
      self.current(undefined);
      branches.forEach(function(branch) {
        if (branch.current) {
          self.current(branch.name);
        }
      });
    }).catch(function(err) { self.current("~error"); })
    .finally(function() { self.fetchingProgressBar.stop() })
}

BranchesViewModel.prototype.branchRemove = function(branch) {
  var self = this;
  components.create('yesnodialog', { title: 'Are you sure?', details: 'Deleting ' + branch.name + ' branch cannot be undone with ungit.'})
    .show()
    .closeThen(function(diag) {
      if (!diag.result()) return;
      self.server.delPromise('/branches', { name: branch.name, path: self.repoPath() })
        .then(function() { programEvents.dispatch({ event: 'working-tree-changed' }); });
    });
}
