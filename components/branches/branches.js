
var ko = require('knockout');
var _ = require('lodash');
var async = require('async');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');
const isFetchRemoteBranches = 'isFetchRemoteBranches';

components.register('branches', function(args) {
  return new BranchesViewModel(args.server, args.graph, args.repoPath);
});

function BranchesViewModel(server, graph, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.server = server;
  this.branches = ko.observableArray();
  this.current = ko.observable();
  this.isFetchRemoteBranches = ko.observable(localStorage.getItem(isFetchRemoteBranches) == 'true');
  this.graph = graph;
  this.isFetchRemoteBranches.subscribe((value) => {
    localStorage.setItem(isFetchRemoteBranches, value);
    this.updateBranches();
    return value;
  });
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
  branch.checkout();
}
BranchesViewModel.prototype.updateBranches = function() {
  var self = this;

  this.server.getPromise('/branches', { path: this.repoPath(), isFetchRemoteBranches: this.isFetchRemoteBranches() })
    .then(function(branches) {
      const sorted = branches.filter((b) => b.name.indexOf('->') === -1)
        .map((b) => {
          const refName = `refs/${b.name.indexOf('remotes/') === 0 ? '' : 'heads/'}${b.name}`;
          if (b.current) {
            self.current(b.name);
          }
          return self.graph.getRef(refName);
        }).sort((a, b) => {
          if (a.current() || b.current()) {
            return a.current() ? -1 : 1;
          } else if (a.isRemoteBranch === b.isRemoteBranch) {
            if (a.name < b.name) {
               return -1;
            } if (a.name > b.name) {
              return 1;
            }
            return 0;
          } else {
            return a.isRemoteBranch ? 1 : -1;
          }
        });
      self.branches(sorted);
    }).catch(function(err) { self.current("~error"); });
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
