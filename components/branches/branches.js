
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
  this.branches = ko.observable([]);
  this.currentBranch = ko.observable(null);

  this.currentBranch.subscribe(function(value) {
    programEvents.dispatch({ event: 'current-branch-changed', newBranch: value });
  });

  this.fetchLabel = ko.computed(function() {
    if (self.currentBranch()) return 'Fetch nodes from ' + self.currentBranch();
    else return 'No branches specified';
  })

  this.fetchingProgressBar = components.create('progressBar', { predictionMemoryKey: 'fetching-' + this.repoPath, temporary: true });
  
  this.fetchEnabled = ko.computed(function() {
    return self.branches().length > 0;
  });
  
  this.shouldAutoFetch = ungit.config.autoFetch;
  this.updateBranches(); 
}

BranchesViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('branches', this, {}, parentElement);
}
BranchesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'request-app-content-refresh' ||
    event.event == 'working-tree-changed')
    this.updateBranches();
}
BranchesViewModel.prototype.clickFetch = function() { this.fetch({ nodes: true, tags: true }); }
BranchesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'request-credentials') this.fetchingProgressBar.pause();
  else if (event.event == 'request-credentials-response') this.fetchingProgressBar.unpause();
  else if (event.event == 'request-fetch-tags') this.fetch({ tags: true });
}
BranchesViewModel.prototype.fetch = function(options) {
  if (this.fetchingProgressBar.running()) return;
  var self = this;

  this.fetchingProgressBar.start();
  var jobs = [];
  //if (options.nodes) jobs.push(function(done) { self.server.post('/fetch', { path: self.repoPath, branch: self.currentBranch() }, done);  });
  async.parallel(jobs, function(err, result) {
    self.fetchingProgressBar.stop();
  });
}

BranchesViewModel.prototype.updateBranches = function() {
  var self = this;
  this.server.get('/branches', { path: this.repoPath }, function(err, branches) {
    if (err && err.errorCode == 'not-a-repository') return true;
    if (err) return;
    branches = branches.map(function(branch) {
      return {
        name: branch.name,
        current: branch.current,
        changeBranch: function() { self.currentBranch(branch) }
      }
    });
    self.branches(branches);
    if (!self.currentBranch() && branches.length > 0) {
      if (branch = _.find(branches, { 'current': true }))
        self.currentBranch(branch.name);
      else
        self.currentBranch(branches[0].name);
      if (self.shouldAutoFetch) {
        self.fetch({ nodes: true, tags: true });
      }
    }
    self.shouldAutoFetch = false;
  });
}
BranchesViewModel.prototype.showAddBranchDialog = function() {
  var self = this;
  var diag = components.create('addbranchdialog');
  diag.closed.add(function() {
    if (diag.isSubmitted()) {
      self.server.post('/branches/' + encodeURIComponent(diag.name()), { path: self.repoPath, url: diag.url() }, function(err, res) {
        if (err) return;
        self.updatebranches();
      })
    }
  });
  programEvents.dispatch({ event: 'request-show-dialog', dialog: diag });
}

