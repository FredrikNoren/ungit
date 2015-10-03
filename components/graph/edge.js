var ko = require('knockout');

var EdgeViewModel = function(graph, nodeAsha1, nodeBsha1) {
  var self = this;
  this.nodeA = graph.getNode(nodeAsha1);
  this.nodeB = graph.getNode(nodeBsha1);
  this.d = ko.computed(function() {
    var pathPrefix = "M " + self.nodeA.cx() + " " + self.nodeA.cy();
    if (self.nodeB.isInited) {
      return pathPrefix + " L " + self.nodeB.cx() + " " + self.nodeB.cy();
    } else {
      return pathPrefix + " V " + graph.graphHeight();
    }
  });
}
module.exports = EdgeViewModel;
