
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
  this.branchesAndLocalTags = ko.observableArray();
  this.current = ko.observable();
  this.isLocalBranchOnly = ko.observable(localStorage.getItem(isLocalBranchOnly) == 'true');
  this.graph = graph;
  this.isLocalBranchOnly.subscribe((value) => {
    localStorage.setItem(isLocalBranchOnly, value);
    this.updateRefs();
    return value;
  });
  this.fetchLabel = ko.computed(function() {
    if (self.current()) {
      return self.current();
    }
  });
  this.updateRefsDebounced = _.debounce(this.updateRefs, 500);
}
BranchesViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('branches', this, {}, parentElement);
}
BranchesViewModel.prototype.clickFetch = function() { this.updateRefs(); }
BranchesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event === 'working-tree-changed' || event.event === 'request-app-content-refresh' ||
    event.event === 'branch-updated' || event.event === 'git-directory-changed') {
    this.updateRefsDebounced();
  }
}
BranchesViewModel.prototype.checkoutBranch = function(branch) {
  branch.checkout();
}
BranchesViewModel.prototype.updateRefs = function() {
  this.server.getPromise('/branches', { path: this.repoPath() })
    .then((branches) => {
      branches.forEach((b) => { if (b.current) { this.current(b.name); }});
    }).catch((err) => { this.current("~error"); });

  // refreshes tags branches and remote branches
  return this.server.getPromise('/refs', { path: this.repoPath() })
    .then((refs) => {
      const version = Date.now();
      let filteredRefs;
      if (this.isLocalBranchOnly()) {
        filteredRefs = refs.filter(r => !r.name.startsWith("refs/tags/") && !r.name.startsWith("refs/remotes/"));
      } else {
        filteredRefs = refs;
      }
      const sorted = filteredRefs.map((r) => {
        const ref = this.graph.getRef(r.name.replace('refs/tags', 'tag: refs/tags'));
        ref.node(this.graph.getNode(r.sha1));
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
      this.branchesAndLocalTags(sorted);
      this.graph.refs().forEach((ref) => {
        // ref was removed from another source
        if (!ref.isRemoteTag && ref.value !== 'HEAD' && (!ref.version || ref.version < version)) {
          ref.remove(true);
        }
      });
    }).catch((e) => this.server.unhandledRejection(e))
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
