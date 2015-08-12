var ko = require('knockout');
var components = require('ungit-components');
var Promise = require("bluebird");

components.register('graph', function(args) {
  return new GraphViewModel(args.server, args.repoPath);
});

function GraphViewModel(server, repoPath) {
  this.repoPath = ko.observable(repoPath);
  this.maxNNodes = 25;
  this.server = server;
  this.loadNodesFromApi();
}

// this function needs to be in the server itself.
GraphViewModel.prototype.getServer = function(url, arg) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self.server.get(url, arg, function(err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

GraphViewModel.prototype.loadNodesFromApi = function(callback) {
  var self = this;

  // this.nodesLoader.start();
  this.getServer('/log', { path: this.repoPath(), limit: this.maxNNodes })
    .then(function(logEntries) {
      // self.setNodesFromLog(logEntries);
    })
    .finally(function(){
      // self.nodesLoader.stop();
      if (callback) callback();
    });
}
