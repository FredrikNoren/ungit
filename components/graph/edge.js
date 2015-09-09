var ko = require('knockout');

var EdgeViewModel = function(graph, nodeAsha1, nodeBsha1) {
  var self = this;
  this.nodeA = ko.observable(graph.nodesById[nodeAsha1]);
  this.nodeB = ko.observable(graph.nodesById[nodeBsha1]);
  this.path = ko.computed(function() {
    var pathPrefix = "M " + self.nodeA().cx() + " " + self.nodeA().cy();
    if (self.nodeB()) {
      return pathPrefix + " L " + self.nodeB().cx() + " " + self.nodeB().cy();
    } else {
      return pathPrefix + " v 99999";
    }
  });

  if (!this.nodeB()) {
    // if "to" node doesn't exist, watch for it and update and unsubscribe
    var nodeWatcher = graph.nodes.subscribe(function() {
      self.nodeB(graph.nodesById[nodeBsha1]);

      if (!self.nodeB()) return;
      nodeWatcher.dispose();
    });
  }
}
module.exports = EdgeViewModel;
