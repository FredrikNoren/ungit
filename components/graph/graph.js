var ko = require('knockout');
var components = require('ungit-components');
var Promise = require("bluebird");
var d3 = require("d3");
var GitNodeViewModel = require('./git-node');

components.register('graph', function(args) {
  return new GraphViewModel(args.server, args.repoPath);
});

function GraphViewModel(server, repoPath) {
  this.repoPath = ko.observable(repoPath);
  this.maxNNodes = 25;
  this.server = server;
  this.loadNodesFromApi();
  this.nodes = ko.observableArray();
  this.nodesById = {}
  
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

GraphViewModel.prototype.getNode = function(node) {
  var nodeViewModel = this.nodesById[node.sha1];
  if (!nodeViewModel) nodeViewModel = this.nodesById[node.sha1] = new GitNodeViewModel(this, node);
  return nodeViewModel;
}

GraphViewModel.prototype.loadNodesFromApi = function(callback) {
  var self = this;

  // this.nodesLoader.start();
  this.getServer('/log', { path: this.repoPath(), limit: this.maxNNodes })
    .then(function(nodes) {
      self.setNodesFromLog(self.nodes().concat(nodes.map(function(node, index) {
          var nodeVm = self.getNode(node);
          
          
          return nodeVm;
        })
      ));
    })
    .finally(function(){
      // self.nodesLoader.stop();
      if (callback) callback();
    });
}

GraphViewModel.prototype.setNodesFromLog = function(nodes) {
  var self = this;
  
  if (!this.svg) {
    this.svg = d3.select("#graph-svg").append("svg:svg")
      .attr("width", "100%")
      .attr("height", 2000);
  }
  
  this.svg.selectAll("circle").data(nodes).enter()
    .append("svg:circle")
      .attr("r", function(d) { d.r = 30; return 30; })
      .attr("cx", function(d) { d.cx = self.cx; return self.cx; })
      .attr("cy", function(d) { self.cy += 160; d.cy = self.cy; return self.cy; })
      .on('click', function(d) { console.log(d); d.click(); });
  this.nodes(nodes);
}

GraphViewModel.prototype.scrolledToEnd = function() {
  
}

GraphViewModel.prototype.handleBubbledClick = function() {
  
}
