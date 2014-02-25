
var ko = require('knockout');
var Vector2 = require('ungit-vector2');
var NodeViewModel = require('./node').NodeViewModel;
var EdgeViewModel = require('./edge').EdgeViewModel;
var Color = require('color');


function MergeViewModel(graph, headNode, node) {
  var self = this;

  this.graph = graph;

  var newNode = {
    position: new Vector2(
      headNode.x(),
      headNode.y() - 35),
    radius: Math.max(headNode.radius(), node.radius())
  };
  newNode.position.y -= newNode.radius*2;

  this.newNode = new NodeViewModel(newNode.position, newNode.radius);
  this.edges = [
    new EdgeViewModel(headNode, this.newNode),
    new EdgeViewModel(node, this.newNode)
  ];
  graph.dimCommit(true)
}
exports.MergeViewModel = MergeViewModel;
MergeViewModel.prototype.type = 'merge';
MergeViewModel.prototype.destroy = function() {
  this.graph.dimCommit(false)
}


function RebaseViewModel(onto, nodesThatWillMove) {
  var self = this;
  
  var rebaseNodes = {};
  this.path = nodesThatWillMove;
  this.path.slice(0, -1).forEach(function(node) { rebaseNodes[node.sha1] = true; });

  this.arrows = [];
  this.nodes = this.path.slice(0, -1).map(function(node, i) {
    i = (self.path.length - 1 - i);
    var n = new NodeViewModel(
      new Vector2(
        onto.x() + (node.x() - self.path[self.path.length - 1].x()),
        onto.y() - i * (node.radius() * 2 + 20)),
      node.radius());
    var d = n.position().sub(node.position()).normalize();
    var from = node.position().add(d.mul(node.radius() + 3));
    var to = n.position().sub(d.mul(node.radius()));
    var l = to.sub(from).length();
    if (l > 45) to = to.sub(d.mul(45));
    else to = from.add(d);
    self.arrows.push({ from: from, to: to });
    return n;
  });

  this.edges = [];
  var prevNode = onto;
  this.nodes.reverse().forEach(function(node) {
    self.edges.push(new EdgeViewModel(node, prevNode));
    prevNode = node;
  });

  this.path.slice(0, -1).forEach(function(node) {
    node.savedColor = node.color();
    node.color(Color(node.color()).alpha(0.2).rgbaString());
  });
}
exports.RebaseViewModel = RebaseViewModel;
RebaseViewModel.prototype.type = 'rebase';
RebaseViewModel.prototype.destroy = function() {
  this.path.slice(0, -1).forEach(function(node) {
    node.color(node.savedColor);
  });
}
RebaseViewModel.prototype.updateAnimationFrame = function(deltaT) {
  this.nodes.forEach(function(node) {
    node.updateAnimationFrame(deltaT);
  });
}


function ResetViewModel(nodes) {
  this.nodes = nodes;
}
exports.ResetViewModel = ResetViewModel;
ResetViewModel.prototype.type = 'reset';


function PushViewModel(fromNode, toNode) {
  this.fromPosition = fromNode.position().clone();
  this.toPosition = toNode.position().clone();
  this.fromPosition.x += fromNode.radius() + 50;
  this.toPosition.x += toNode.radius() + 50;
  if (this.fromPosition.y > this.toPosition.y) {
    this.fromPosition.y -= 20;
    this.toPosition.y += 20;
  } else {
    this.fromPosition.y += 20;
    this.toPosition.y -= 20;
  }
  // adjust for the arrow
  var d = this.toPosition.sub(this.fromPosition).normalize();
  this.toPosition = this.toPosition.sub(d.mul(45));
}
exports.PushViewModel = PushViewModel;
PushViewModel.prototype.type = 'push';