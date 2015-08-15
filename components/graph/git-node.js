var ko = require('knockout');
var components = require('ungit-components');
var GitRefViewModel = require('./git-ref');

var GitNodeViewModel = function(graph, logEntry, index) {
  var self = this;
  this.graph = graph;
  this.logEntry = logEntry;
  this.commitContainerVisible = ko.observable(true);
  this.title = ko.observable(this.logEntry.message.split('\n')[0]);
  this.parents = ko.observable(this.logEntry.parents || []);
  this.commitTime = ko.observable(this.logEntry.commitDate);
  this.index = ko.observable(index ? undefined : index);
  this.color = ko.observable();
  this.ideologicalBranch = ko.observable();
  this.ideologicalBranch.subscribe(function(value) {
    self.color(value ? value.color : '#666');
  });
  this.remoteTags = ko.observable([]);
  this.branchesAndLocalTags = ko.observableArray();
  if (this.logEntry.refs) {
    var refVMs = this.logEntry.refs.map(function(ref) {
      var refViewModel = self.getRef(ref);
      refViewModel.node(self);
      return refViewModel;
    });
    this.branchesAndLocalTags(refVMs);
  }
  this.refs = ko.computed(function() {
    var rs = self.branchesAndLocalTags().concat(self.remoteTags());
    rs.sort(function(a, b) {
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return a.refName < b.refName ? -1 : 1;
    });
    return rs;
  });
  
  
  
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
    refViewModel = this.graph.refsByRefName[ref] = new GitRefViewModel(ref, this.graph);
    this.graph.refs.push(refViewModel);
  }
  return refViewModel;
}
