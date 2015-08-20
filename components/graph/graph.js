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
  this.currentActionContext = ko.observable();
  
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
  if (parent) {
    this.traverseNodeLeftParents(parent, callback);
  }
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
  
  // Filter out nodes which doesn't have a branch (staging and orphaned nodes)
  nodes = nodes.filter(function(node) { return (node.ideologicalBranch() && !node.ideologicalBranch().isStash) || node.ancestorOfHEADTimeStamp == updateTimeStamp; })

  //var concurrentBranches = { };

  var branchSlots = [undefined];
  
  // Then iterate from the bottom to fix the orders of the branches
  for (var i = nodes.length - 1; i >= 0; i--) {
    var node = nodes[i];
    if (node.ancestorOfHEADTimeStamp == updateTimeStamp) continue;
    var ideologicalBranch = node.ideologicalBranch();

    // First occurence of the branch, find an empty slot for the branch
    if (ideologicalBranch.lastSlottedTimeStamp != updateTimeStamp) {
      ideologicalBranch.lastSlottedTimeStamp = updateTimeStamp;
      var slot = branchSlots.indexOf(undefined);
      if (slot == branchSlots.length) {
        branchSlots.push(ideologicalBranch);
        slot = branchSlots.length - 1;
      }
      ideologicalBranch.branchOrder = slot;
      branchSlots[slot] = slot;
    }

    node.branchOrder = ideologicalBranch.branchOrder;
  }
  
  var prevNode;
  nodes.forEach(function(node) {
    node.branchOrder = branchSlots.length - node.branchOrder;
    node.ancestorOfHEAD(node.ancestorOfHEADTimeStamp == updateTimeStamp);
    node.aboveNode = prevNode;
    if (prevNode) prevNode.belowNode = node;
    prevNode = node;
  });
  
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
      .attr("r", function(d) { 
        d.r = d.ancestorOfHEAD() ? 30 : 15;
        return d.r;
      }).attr("cx", function(d) { 
        d.cx = d.ancestorOfHEAD() ? 30 : 30 + 90 * d.branchOrder;
        return d.cx;
      }).attr("cy", function(d) { 
        if (d.ancestorOfHEAD()) {
          if (!d.aboveNode) {
            d.cy = 120;
          } else if (d.aboveNode.ancestorOfHEAD()) {
            d.cy = d.aboveNode.cy + 120;
          } else {
            d.cy = d.aboveNode.cy + 60;
          }
        } else {
          if (d.aboveNode) {
            d.cy = d.aboveNode.cy + 60;
          } else {
            d.cy = 120;
          }
        }
        if (d.aboveNode && d.aboveNode.selected()) {
          d.cy = d.aboveNode.cy + d.aboveNode.commitComponent.element().offsetHeight + 30;
        }
        return d.cy;
      }).on('click', function(d) { console.log(d); d.click(); });

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
