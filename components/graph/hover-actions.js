var getEdgeModelWithD = function(d, stroke, strokeWidth, strokeDasharray, markerEnd) {
  return { d: d,
          stroke: stroke ? stroke : '#4A4A4A',
          strokeWidth: strokeWidth ? strokeWidth : '8',
          strokeDasharray: strokeDasharray ? strokeDasharray : '10, 5',
          markerEnd: markerEnd ? markerEnd : '' };
}

var getEdgeModel = function(scx, scy, tcx, tcy, stroke, strokeWidth, strokeDasharray, markerEnd) {
  return getEdgeModelWithD("M " + scx + " " + scy + " L " + tcx + " " + tcy, stroke, strokeWidth, strokeDasharray, markerEnd);
}

var getNodeModel = function(cx, cy, r, fill, stroke, strokeWidth, strokeDasharray) {
  return { cx: cx,
          cy: cy,
          r: r,
          fill: fill,
          stroke: stroke ? stroke : '#41DE3C',
          strokeWidth: strokeWidth ? strokeWidth : '8',
          strokeDasharray: strokeDasharray ? strokeDasharray : '10, 5' };
}

function HoverViewModel() {
  this.bgEdges = [];
  this.nodes = [];
  this.fgEdges = [];
}

function MergeViewModel(graph, headNode, node) {
  var self = this;
  HoverViewModel.call(this);
  this.graph = graph;
  this.bgEdges = [ getEdgeModel(headNode.cx(), (headNode.cy() - 110), headNode.cx(), headNode.cy()),
                getEdgeModel(headNode.cx(), (headNode.cy() - 110), node.cx(), node.cy()) ];
  this.nodes = [ getNodeModel(headNode.cx(), headNode.cy() - 110, Math.max(headNode.r(), node.r()), '#252833', '#41DE3C', '8', '10, 5') ];

  graph.dimCommit(true);
}
exports.MergeViewModel = MergeViewModel;
MergeViewModel.prototype.destroy = function() {
  this.graph.dimCommit(false);
}

function RebaseViewModel(onto, nodesThatWillMove) {
  var self = this;
  HoverViewModel.call(this);
  nodesThatWillMove = nodesThatWillMove.slice(0, -1);

  if (nodesThatWillMove.length == 0) return;

  this.bgEdges.push(getEdgeModel(onto.cx(), onto.cy(), onto.cx(), onto.cy() - 60));
  nodesThatWillMove.forEach(function(node, i) {
    var cy = onto.cy() + (-90 * (i + 1));
    self.nodes.push(getNodeModel(onto.cx(), cy, 28, 'transparent'));
    if (i + 1 < nodesThatWillMove.length) {
      self.bgEdges.push(getEdgeModel(onto.cx(), (cy - 25), onto.cx(), (cy - 65)));
    }
  });
}
exports.RebaseViewModel = RebaseViewModel;

function ResetViewModel(nodes) {
  var self = this;
  HoverViewModel.call(this);

  nodes.forEach(function(node) {
    self.fgEdges.push(getEdgeModelWithD(node.getLeftToRightStrike(), 'rgb(255, 129, 31)', '8', '0, 0'))
    self.fgEdges.push(getEdgeModelWithD(node.getRightToLeftStrike(), 'rgb(255, 129, 31)', '8', '0, 0'));
  });
}
exports.ResetViewModel = ResetViewModel;

function PushViewModel(fromNode, toNode) {
  HoverViewModel.call(this);
  this.fgEdges = [getEdgeModel(fromNode.cx(), fromNode.cy(), toNode.cx(), (toNode.cy() + 40), 'rgb(61, 139, 255)', '15', '10, 5', 'url(#pushArrowEnd)' )];
}
exports.PushViewModel = PushViewModel;
