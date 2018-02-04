
var ko = require('knockout');
var _ = require('lodash');
var async = require('async');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');
const isLocalBranchOnly = 'isLocalBranchOnly';

components.register('branches', function(args) {
  return new BranchesViewModel(args.server, args.graph, args.repoPath);
});

function BranchesViewModel(server, graph, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.server = server;
  this.branches = ko.observableArray();
  this.current = ko.observable();
  this.isLocalBranchOnly = ko.observable(localStorage.getItem(isLocalBranchOnly) == 'true');
  this.graph = graph;
  this.isLocalBranchOnly.subscribe((value) => {
    localStorage.setItem(isLocalBranchOnly, value);
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
  return this.server.getPromise('/branches', { path: this.repoPath(), isLocalBranchOnly: this.isLocalBranchOnly() })
    .then((branches) => {
      const version = Date.now();
      const sorted = branches.filter((b) => b.name.indexOf('->') === -1)
        .map((b) => {
          const refName = `refs/${b.name.indexOf('remotes/') === 0 ? '' : 'heads/'}${b.name}`;
          if (b.current) {
            this.current(b.name);
          }
          const ref = this.graph.getRef(refName);
          ref.version = version;
          return ref;
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
      this.branches(sorted);
      this.graph.refs().forEach((ref) => {
        // branch was removed from another source
        if (ref.value !== 'HEAD' && ref.isBranch && ref.version !== version) {
          ref.remove(true);
        }
      });
    }).catch((err) => { this.current("~error"); });
}

BranchesViewModel.prototype.branchRemove = function(branch) {
  var self = this;
  var details = `"${branch.refName}"`;
  if (branch.isRemoteBranch) {
    details = `<code style='font-size: 100%'>REMOTE</code> ${details}`;
  }
  components.create('yesnodialog', { title: 'Are you sure?', details: 'Deleting ' + details + ' branch cannot be undone with ungit.'})
    .show()
    .closeThen(function(diag) {
      if (!diag.result()) return;
      var url = '/branches';
      if (branch.isRemote) url = '/remote' + url;
      self.server.delPromise(url, { path: self.graph.repoPath(), remote: branch.isRemote ? branch.remote : null, name: branch.refName })
        .then(function() { programEvents.dispatch({ event: 'working-tree-changed' }); })
        .catch((e) => this.server.unhandledRejection(e));
    });
}
BranchesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'git-directory-changed') {
    this.updateBranches();
  } else if (event.event == 'request-app-content-refresh') {
    this.updateBranches();
  }
}
