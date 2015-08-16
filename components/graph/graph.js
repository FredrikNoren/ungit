var ko = require('knockout');
var components = require('ungit-components');
var d3 = require("d3");
var GitNodeViewModel = require('./git-node');
var _ = require('lodash');
var moment = require('moment');


components.register('graph', function(args) {
  return new GraphViewModel(args.server, args.repoPath);
});

function GraphViewModel(server, repoPath) {
  var self = this;
  this.repoPath = ko.observable(repoPath);
  this.maxNNodes = 25;
  this.server = server;
  this.loadNodesFromApi();
  this.nodes = ko.observableArray();
  this.refs = ko.observableArray();
  this.nodesById = {};
  this.refsByRefName = {};
  this.checkedOutBranch = ko.observable();
  this.checkedOutRef = ko.computed(function() {
    if (self.checkedOutBranch())
      return self.getRef('refs/heads/' + self.checkedOutBranch());
    else
      return null;
  });
  this.HEAD = ko.observable();
  
  this.svg = null;
  this.cx = 610;
  this.cy = -80;
}

GraphViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('graph', this, {}, parentElement);
}

GraphViewModel.prototype.getNode = function(node, index) {
  var nodeViewModel = this.nodesById[node.sha1];
  if (!nodeViewModel) nodeViewModel = this.nodesById[node.sha1] = new GitNodeViewModel(this, node, index);
  return nodeViewModel;
}

GraphViewModel.prototype.loadNodesFromApi = function(callback) {
  var self = this;

  // this.nodesLoader.start();
  this.server.queryPromise('GET', '/log', { path: this.repoPath(), limit: this.maxNNodes })
    .then(function(nodes) {
      
      var nodeVMs = nodes.map(function(node, index) {
        return self.getNode(node, index);
      });
      
      self.setNodesFromLog(nodeVMs);
    })
    .finally(function(){
      // self.nodesLoader.stop();
      if (callback) callback();
    });
}

GraphViewModel.prototype.getHEAD = function(nodes) {
  return _.find(nodes, function(node) { return _.find(node.refs(), 'isLocalHEAD'); });
}

GraphViewModel.prototype.traverseNodeLeftParents = function(node, callback) {
  if (node.index() >= this.maxNNodes) return;
  callback(node);
  var parent = this.nodesById[node.parents()[0]];
  if (parent)
    this.traverseNodeLeftParents(parent, callback);
}

GraphViewModel.prototype.setNodesFromLog = function(nodes) {
  var self = this;
  
  nodes = nodes.slice(0, this.maxNNodes);
  
  this.markNodesIdeologicalBranches(this.refs(), nodes, this.nodesById);
  this.HEAD(this.getHEAD(nodes));
  var HEAD = this.HEAD();
  
  var updateTimeStamp = moment().valueOf();
  if (HEAD) {
    this.traverseNodeLeftParents(HEAD, function(node) {
      node.ancestorOfHEADTimeStamp = updateTimeStamp;
    });
  }
  
  this.render(nodes);
} 

GraphViewModel.prototype.render = function(nodes) {
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
      
      
  this.nodes(this.nodes().concat(nodes));
}

GraphViewModel._markIdeologicalStamp = 0;
GraphViewModel.prototype.markNodesIdeologicalBranches = function(refs, nodes, nodesById) {
  var self = this;
  refs = refs.filter(function(r) { return !!r.node(); });
  refs = refs.sort(function(a, b) {
    if (a.isLocal && !b.isLocal) return -1;
    if (b.isLocal && !a.isLocal) return 1;
    if (a.isBranch && !b.isBranch) return -1;
    if (b.isBranch && !a.isBranch) return 1;
    if (a.isHead && !b.isHead) return 1;
    if (!a.isHead && b.isHead) return -1;
    if (a.isStash && !b.isStash) return 1;
    if (b.isStash && !a.isStash) return -1;
    if (a.node() && a.node().commitTime() && b.node() && b.node().commitTime())
      return a.node().commitTime() - b.node().commitTime();
    return a.refName < b.refName ? -1 : 1;
  });
  var stamp = GraphViewModel._markIdeologicalStamp++;
  refs.forEach(function(ref) {
    self.traverseNodeParents(ref.node(), function(node) {
      if (node.stamp == stamp) return false;
      node.stamp = stamp;
      node.ideologicalBranch(ref);
      return true;
    });
  });
}

GraphViewModel.prototype.traverseNodeParents = function(node, callback) {
  if (node.index() >= this.maxNNodes) return false;
  if (!callback(node)) return false;
  for (var i = 0; i < node.parents().length; i++) {
    // if parent, travers parent
    var parent = this.nodesById[node.parents()[i]];
    if (parent) {
      this.traverseNodeParents(parent, callback);
    }
  }
}

GraphViewModel.prototype.scrolledToEnd = function() {
  
}

GraphViewModel.prototype.handleBubbledClick = function() {
  
}
