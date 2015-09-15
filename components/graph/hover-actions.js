var ko = require('knockout');
var NodeViewModel = require('./git-node');
var EdgeViewModel = require('./edge');
var Color = require('color');


// function MergeViewModel(graph, headNode, node) {
//   var self = this;
//
//   this.graph = graph;
//
//   var newNode = {
//     position: new Vector2(
//       headNode.x(),
//       headNode.y() - 35),
//     radius: Math.max(headNode.radius(), node.radius())
//   };
//   newNode.position.y -= newNode.radius*2;
//
//   this.newNode = new NodeViewModel(newNode.position, newNode.radius);
//   this.edges = [
//     new EdgeViewModel(headNode, this.newNode),
//     new EdgeViewModel(node, this.newNode)
//   ];
//   graph.dimCommit(true)
// }
// exports.MergeViewModel = MergeViewModel;
// MergeViewModel.prototype.type = 'merge';
// MergeViewModel.prototype.destroy = function() {
//   this.graph.dimCommit(false)
// }


function RebaseViewModel(onto, nodesThatWillMove) {
  var self = this;
  this.nodes = [];
  this.edges = [];
  nodesThatWillMove = nodesThatWillMove.slice(0, -1);
  this.edges.push({ d: "M " + onto.cx() + " " + onto.cy() + " L " + onto.cx() + " " + nodesThatWillMove[nodesThatWillMove.length - 1].cy() });
  nodesThatWillMove.forEach(function(node, i) {
    var cy = onto.cy() + (-90 * (i + 1));
    self.nodes.push({ cx: onto.cx(), cy: cy, r: 50, color: onto.color() });
    if (i + 1 < nodesThatWillMove.length) {
      self.edges.push({ d: "M " + onto.cx() + " " + (cy - 25) + " L " + onto.cx() + " " + (cy - 65) });
    }
  });
}
exports.RebaseViewModel = RebaseViewModel;
RebaseViewModel.prototype.type = 'rebase';
RebaseViewModel.prototype.destroy = function() {
}

function ResetViewModel(nodes) {
  this.nodes = nodes;
}
exports.ResetViewModel = ResetViewModel;
ResetViewModel.prototype.type = 'reset';

function PushViewModel(fromNode, toNode) {
  this.edges = [{ d: "M " + fromNode.cx() + " " + fromNode.cy() + " L " + toNode.cx() + " " + (toNode.cy() + 40) }];
}
exports.PushViewModel = PushViewModel;
PushViewModel.prototype.type = 'push';
