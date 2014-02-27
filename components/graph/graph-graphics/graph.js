
var ko = require('knockout');
var Vector2 = require('ungit-vector2');
var EdgeViewModel = require('./edge').EdgeViewModel;

var GraphViewModel = function() {
  var self = this;
  this.nodes = ko.observable([]);
  this.commitNode = new CommitNodeViewModel(this);
  this.commitNodeEdge = new EdgeViewModel(this.commitNode);
  this.offset = ko.observable(new Vector2(0, 0));
  this.edges = ko.observable([]);
  this.showCommitNode = ko.observable();
  this.dimCommit = ko.observable(false);
  this.commitOpacity = ko.computed(function() { return self.dimCommit() ? 0.1 : 1; });
  this.graphWidth = ko.computed(function() {
    var width = 0;
    self.nodes().forEach(function(node) {
      width = Math.max(width, node.x() + node.radius() + self.offset().x + 200);
    });
    return width;
  });
  this.graphHeight = ko.computed(function() {
    var height = 0;
    self.nodes().forEach(function(node) {
      height = Math.max(height, node.y() + node.radius() + self.offset().y + 5);
    });
    return height;
  });

  this.hoverGraphActionGraphic = ko.observable();
  var prevHoverGraphic;
  this.hoverGraphActionGraphic.subscribe(function(value) {
    prevHoverGraphic = value;
  }, null, 'beforeChange');
  this.hoverGraphActionGraphic.subscribe(function(newValue) {
    if (newValue != prevHoverGraphic && prevHoverGraphic && prevHoverGraphic.destroy)
      prevHoverGraphic.destroy();
  });
  this.hoverGraphActionGraphicType = ko.computed(function() {
    return self.hoverGraphActionGraphic() ? self.hoverGraphActionGraphic().type : '';
  })
}
exports.GraphViewModel = GraphViewModel;
GraphViewModel.prototype.updateAnimationFrame = function(deltaT) {
  if (this.hoverGraphActionGraphic() && this.hoverGraphActionGraphic().updateAnimationFrame) {
    this.hoverGraphActionGraphic().updateAnimationFrame(deltaT);
  }
  this.nodes().forEach(function(node) {
    node.updateAnimationFrame(deltaT);
  });
  this.edges().forEach(function(edge) {
    edge.updateAnimationFrame(deltaT);
  });
  this.commitNodeEdge.updateAnimationFrame(deltaT);
}

var CommitNodeViewModel = function(graph) {
  this.position = ko.observable(new Vector2(30, 30));
  this.radius = ko.observable(28);
  this.outerRadius = ko.observable(32);
  //this.color = ko.computed(function() { return graph.HEAD() && graph.HEAD().ideologicalBranch() ? graph.HEAD().ideologicalBranch().color : '#666' });
  this.color = ko.observable('#ff00ff')
}