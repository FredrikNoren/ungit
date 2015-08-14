var ko = require('knockout');
var components = require('ungit-components');
var GitRefViewModel = require('./git-ref');

var GitNodeViewModel = function(graph, logEntry) {
  var self = this;
  this.graph = graph;
  this.logEntry = logEntry;
  this.commitContainerVisible = ko.observable(true);
  this.title = ko.observable(this.logEntry.message.split('\n')[0]);
  this.parents = ko.observable(this.logEntry.parents || []);
  this.commitTime = ko.observable(this.logEntry.commitDate);
  this.branchesAndLocalTags = ko.observableArray();
  if (this.logEntry.refs) {
    var refVMs = this.logEntry.refs.map(function(ref) {
      var refViewModel = self.getRef(ref);
      refViewModel.node(self);
      return refViewModel;
    });
    this.branchesAndLocalTags(refVMs);
  }
  
  
  
  this.commitComponent = components.create('commit', {
    sha1: logEntry.sha1,
    repoPath: this.graph.repoPath(),
    server: this.graph.server
  });
  this.commitComponent.setData(this.logEntry);
}
module.exports = GitNodeViewModel;

GitNodeViewModel.prototype.click = function() {
  
}

GitNodeViewModel.prototype.getRef = function(ref) {
  var refViewModel = this.graph.refsByRefName[ref];
  if (!refViewModel) {
    refViewModel = this.graph.refsByRefName[ref] = new GitRefViewModel(ref, this);
    this.graph.refs.push(refViewModel);
  }
  return refViewModel;
}
