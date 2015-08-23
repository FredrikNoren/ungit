var ko = require('knockout');

var EdgeViewModel = function(graph, nodeAsha1, nodeBsha1) {
  var self = this;
  this.nodeA = graph.nodesById[nodeAsha1];
  var pathPrefix = "M " + self.nodeA.cx() + " " + self.nodeA.cy();
  this.nodeB = graph.nodesById[nodeBsha1];
  this.path = pathPrefix + this.getPathToDest(this.nodeB);
  
  if (!this.nodeB) {
    // if "to" node doesn't exist, watch for it and update and unsubscribe
    var nodeWatcher = graph.nodes.subscribe(function() {
      self.nodeB = graph.nodesById[nodeBsha1];
      
      if (!self.nodeB) return;
      
      self.path = pathPrefix + self.getPathToDest(self.nodeB);
      nodeWatcher.dispose();
    });
  }
}
module.exports = EdgeViewModel;

EdgeViewModel.prototype.getPathToDest = function(nodeB) {
  if (nodeB) {
    return " L " + this.nodeB.cx() + " " + this.nodeB.cy();
  } else {
    return " l 0 99999";
  }
}
