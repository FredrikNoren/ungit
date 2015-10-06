var ko = require('knockout');
var Animateable = require('./animateable');

var EdgeViewModel = function(graph, nodeAsha1, nodeBsha1) {
  var self = this;
  Animateable.call(this);
  this.nodeA = graph.getNode(nodeAsha1);
  this.nodeB = graph.getNode(nodeBsha1);
  this.d = ko.computed(function() {
    var pathPrefix = "M " + self.nodeA.cx() + " " + self.nodeA.cy();
    if (self.nodeB.isInited) {
      return pathPrefix + " L " + self.nodeB.cx() + " " + self.nodeB.cy();
    } else if (graph.graphHeight()) {
      return pathPrefix + " V " + graph.graphHeight();
    } else {
      return ''; // nodes are not ready to calculate path, will be corrected on next calculation
    }
  });
  this.d.subscribe(function(val) {
    self.animate();
  });
}
EdgeViewModel.prototype.getGraphAttr = function() {
  return { d: this.d() };
}
module.exports = EdgeViewModel;
