
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

  this.checkoutLabel = ko.computed(function() {
    if (self.currentBranch()) return 'Checkout ' + self.currentBranch();
    else return 'No branches specified';
  })

  this.checkoutingProgressBar = components.create('progressBar', { predictionMemoryKey: 'checkouting-' + this.repoPath, temporary: true });
  
  this.checkoutEnabled = ko.computed(function() {
    return self.branches().length > 0;
  });
  
  this.shouldAutoCheckout = true;
  this.updateBranches(); 

}

BranchesViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('branches', this, {}, parentElement);
}
BranchesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'current-branch-changer' ||
      event.event == 'git-directory-changed') {
    this.updateBranches();
  }
}
BranchesViewModel.prototype.clickCheckout = function() { this.checkout({ nodes: true, tags: true }); }

BranchesViewModel.prototype.checkout = function(options) {
  if (this.checkoutingProgressBar.running()) return;
  var self = this;
  this.checkoutingProgressBar.start();
  
  this.server.post('/checkout', { path: self.repoPath, name: self.currentBranch()}, function(err){
    if(!err) {
      self.checkoutingProgressBar.stop();
    }
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
        changeBranch: function() { 
          self.currentBranch(branch.name)
          self.checkout()
        }
      }
    });
    self.branches(branches);
    if (branches.length > 0) {
      var branch = _.find(branches, { 'current': true })
      if (branch)
        self.currentBranch(branch.name);
      else
        self.currentBranch(branches[0].name);
      if (self.shouldAutoCheckout) {
        self.checkout({ nodes: true, tags: true });
      }
    }
    self.shouldAutoCheckout = false;
  });
}

