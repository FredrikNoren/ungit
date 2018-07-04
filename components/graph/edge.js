var ko = require('knockout');
var Animateable = require('./animateable');

var EdgeViewModel = function(graph, nodeAsha1, nodeBsha1) {
  var self = this;
  Animateable.call(this);
  this.nodeA = graph.getNode(nodeAsha1);
  this.nodeB = graph.getNode(nodeBsha1);
  this.getGraphAttr = ko.computed(function() {
    if (self.nodeA.isViewable() && (!self.nodeB.isViewable() || !self.nodeB.isInited)) {
      return [self.nodeA.cx(), self.nodeA.cy(), self.nodeA.cx(), self.nodeA.cy(),
              self.nodeA.cx(), graph.graphHeight(), self.nodeA.cx(), graph.graphHeight()];
    } else if (self.nodeB.isInited && self.nodeB.cx() && self.nodeB.cy()) {
      return [self.nodeA.cx(), self.nodeA.cy(), self.nodeA.cx(), self.nodeA.cy(),
              self.nodeB.cx(), self.nodeB.cy(), self.nodeB.cx(), self.nodeB.cy()];
    } else {
      return [0, 0, 0, 0, 0, 0, 0, 0];
    }
  });
  this.getGraphAttr.subscribe(this.animate.bind(this));
}
EdgeViewModel.prototype.setGraphAttr = function(val) {
  this.element().setAttribute('d', 'M' + val.slice(0,4).join(',') + 'L' + val.slice(4,8).join(','));
}
EdgeViewModel.prototype.edgeMouseOver = function() {
  if (this.nodeA) {
    this.nodeA.isEdgeHighlighted(true);
  }
  if (this.nodeB) {
    this.nodeB.isEdgeHighlighted(true);
  }
}
EdgeViewModel.prototype.edgeMouseOut = function() {
  if (this.nodeA) {
    this.nodeA.isEdgeHighlighted(false);
  }
  if (this.nodeB) {
    this.nodeB.isEdgeHighlighted(false);
  }
}
module.exports = EdgeViewModel;
