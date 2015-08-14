var ko = require('knockout');
var components = require('ungit-components');
var GitNodeViewModel = function(graph, logEntry) {
  this.graph = graph;
  this.logEntry = logEntry;
  this.commitContainerVisible = ko.observable(true);
  this.title = ko.observable(this.logEntry.message.split('\n')[0]);
  this.parents = ko.observable(this.logEntry.parents || []);
  this.commitTime = ko.observable(this.logEntry.commitDate);
  
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
