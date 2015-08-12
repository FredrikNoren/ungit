var ko = require('knockout');
var components = require('ungit-components');
var GitNodeViewModel = function(graph, logEntry) {
  this.graph = graph;
  this.logEntry = logEntry;
  
  /**
authorDate: "Tue Aug 11 20:48:15 2015 -0700"
authorEmail: "twinky@codingtwinky.com"
authorName: "codingtwinky"
commitDate: "Tue Aug 11 20:48:15 2015 -0700"
committerEmail: "twinky@codingtwinky.com"
committerName: "codingtwinky"
fileLineDiffs: Array[3]
message: "Add git node view model and on click action"
parents: Array[1]
refs: Array[2]
sha1: "57cdceee1cae1e6baf9b92ae84d5c636fc4e843c"
**/
  
  this.commitComponent = components.create('commit', {
    sha1: logEntry.sha1,
    repoPath: this.graph.repoPath(),
    server: this.graph.server
  });
}
module.exports = GitNodeViewModel;

GitNodeViewModel.prototype.click = function() {
  
}


GitNodeViewModel.prototype.title = function() {
  return '';
} 

GitNodeViewModel.prototype.commitContainerVisible = function() {
  return false;
}
