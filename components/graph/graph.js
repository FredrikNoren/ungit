var ko = require('knockout');
var components = require('ungit-components');
var Promise = require("bluebird");
var d3 = require("d3");

components.register('graph', function(args) {
  return new GraphViewModel(args.server, args.repoPath);
});

function GraphViewModel(server, repoPath) {
  this.repoPath = ko.observable(repoPath);
  this.maxNNodes = 25;
  this.server = server;
  this.loadNodesFromApi();
  this.logEntries = ko.observableArray();
  
  this.svg = null;
  this.cx = 610;
  this.cy = -80;
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

GraphViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('graph', this, {}, parentElement);
}

GraphViewModel.prototype.loadNodesFromApi = function(callback) {
  var self = this;

  // this.nodesLoader.start();
  this.getServer('/log', { path: this.repoPath(), limit: this.maxNNodes })
    .then(function(logEntries) {
      self.logEntries(self.logEntries().concat(logEntries));
      self.setNodesFromLog(logEntries);
    })
    .finally(function(){
      // self.nodesLoader.stop();
      if (callback) callback();
    });
}

GraphViewModel.prototype.setNodesFromLog = function() {
  var self = this;
  
  if (!this.svg) {
    this.svg = d3.select("#graph-svg").append("svg:svg")
      .attr("width", "100%")
      .attr("height", 2000);
  }
  
  this.svg.selectAll("circle").data(this.logEntries()).enter()
    .append("svg:circle")
    .attr("r", 30)
    .attr("cx", function(d) { return self.cx; })
    .attr("cy", function(d) { self.cy += 160; return self.cy; }) 
}
