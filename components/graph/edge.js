var ko = require('knockout');

var EdgeViewModel = function(graph, nodeAsha1, nodeBsha1) {
  var self = this;
  this.graph = graph;
  this.nodeAsha1 = nodeAsha1;
  this.nodeBsha1 = nodeBsha1;
  this.nodeA = this.graph.nodesById[nodeAsha1];
  this.nodeB = undefined;
  this.path = undefined;

  this.updateLocation();
}
module.exports = EdgeViewModel;

EdgeViewModel.prototype.updateLocation = function() {
  if (!this.nodeB) {
    this.nodeB = this.graph.nodesById[this.nodeBsha1];
  }

  var bcx = this.nodeB ? this.nodeB.cx : this.nodeA.cx;
  var bcy = this.nodeB ? this.nodeB.cy : this.nodeA.cy + 180;

  this.path = "M " + this.nodeA.cx + " " + this.nodeA.cy + (this.nodeB ? (" L " + bcx + " " + bcy) : " l 0 99999");
}
