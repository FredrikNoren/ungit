const getEdgeModelWithD = (d, stroke, strokeWidth, strokeDasharray, markerEnd) => ({
  d,
  stroke: stroke ? stroke : '#4A4A4A',
  strokeWidth: strokeWidth ? strokeWidth : '8',
  strokeDasharray: strokeDasharray ? strokeDasharray : '10, 5',
  markerEnd: markerEnd ? markerEnd : ''
});
const getEdgeModel = (scx, scy, tcx, tcy, stroke, strokeWidth, strokeDasharray, markerEnd) => {
  return getEdgeModelWithD(`M ${scx} ${scy} L ${tcx} ${tcy}`, stroke, strokeWidth, strokeDasharray, markerEnd);
}
const getNodeModel = (cx, cy, r, fill, stroke, strokeWidth, strokeDasharray) => ({
  cx,
  cy,
  r,
  fill,
  stroke: stroke ? stroke : '#41DE3C',
  strokeWidth: strokeWidth ? strokeWidth : '8',
  strokeDasharray: strokeDasharray ? strokeDasharray : '10, 5'
});

class HoverViewModel {
  constructor() {
    this.bgEdges = [];
    this.nodes = [];
    this.fgEdges = [];
  }
}

class MergeViewModel extends HoverViewModel {
  constructor(graph, headNode, node) {
    super();
    this.graph = graph;
    this.bgEdges = [ getEdgeModel(headNode.cx(), (headNode.cy() - 110), headNode.cx(), headNode.cy()),
                  getEdgeModel(headNode.cx(), (headNode.cy() - 110), node.cx(), node.cy()) ];
    this.nodes = [ getNodeModel(headNode.cx(), headNode.cy() - 110, Math.max(headNode.r(), node.r()), '#252833', '#41DE3C', '8', '10, 5') ];

    graph.commitOpacity(0.1);
  }

  destroy() {
    this.graph.commitOpacity(1.0);
  }
}

exports.MergeViewModel = MergeViewModel;

class RebaseViewModel extends HoverViewModel {
  constructor(onto, nodesThatWillMove) {
    super();
    nodesThatWillMove = nodesThatWillMove.slice(0, -1);

    if (nodesThatWillMove.length == 0) return;

    this.bgEdges.push(getEdgeModel(onto.cx(), onto.cy(), onto.cx(), onto.cy() - 60));
    nodesThatWillMove.forEach((node, i) => {
      const cy = onto.cy() + (-90 * (i + 1));
      this.nodes.push(getNodeModel(onto.cx(), cy, 28, 'transparent'));
      if (i + 1 < nodesThatWillMove.length) {
        this.bgEdges.push(getEdgeModel(onto.cx(), (cy - 25), onto.cx(), (cy - 65)));
      }
    });
  }
}
exports.RebaseViewModel = RebaseViewModel;

class ResetViewModel extends HoverViewModel {
  constructor(nodes) {
    super();
    nodes.forEach(node => {
      this.fgEdges.push(getEdgeModelWithD(node.getLeftToRightStrike(), 'rgb(255, 129, 31)', '8', '0, 0'))
      this.fgEdges.push(getEdgeModelWithD(node.getRightToLeftStrike(), 'rgb(255, 129, 31)', '8', '0, 0'));
    });
  }
}
exports.ResetViewModel = ResetViewModel;

class PushViewModel extends HoverViewModel {
    constructor(fromNode, toNode) {
    super();
    this.fgEdges = [getEdgeModel(fromNode.cx(), fromNode.cy(), toNode.cx(), (toNode.cy() + 40), 'rgb(61, 139, 255)', '15', '10, 5', 'url(#pushArrowEnd)' )];
  }
}
exports.PushViewModel = PushViewModel;

class SquashViewModel extends HoverViewModel {
  constructor(from, onto) {
    super();
    let path = from.getPathToCommonAncestor(onto);

    if (path.length == 0) {
      return;
    } else if (path.length == 1) {
      path = onto.getPathToCommonAncestor(from)
    } else {
      this.nodes.push(getNodeModel(onto.cx(), onto.cy() - 120, 28, 'transparent'));
    }

    path.slice(0, -1).forEach((node) => {
      this.nodes.push(getNodeModel(node.cx(), node.cy(), node.r() + 2, 'rgba(100, 60, 222, 0.8)'));
    });
  }
}
exports.SquashViewModel = SquashViewModel;
