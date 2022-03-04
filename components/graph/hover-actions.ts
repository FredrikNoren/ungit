class NodeModel {
  cx: number
  cy: number
  r: number
  fill: string
  stroke: string
  strokeWidth: string
  strokeDasharray: string

  constructor(cx: number, cy: number, r: number, fill: string, stroke: string = undefined, strokeWidth: string = undefined, strokeDasharray: string = undefined) {
    this.cx = cx;
    this.cy = cy;
    this.r = r;
    this.fill = fill;
    this.stroke = stroke || '#41DE3C';
    this.strokeWidth = strokeWidth || '8';
    this.strokeDasharray = strokeDasharray || '10, 5';
  }
}

class EdgeModel {
  d: string
  stroke: string
  strokeWidth: string
  strokeDasharray: string
  markerEnd: string

  constructor(d: string, stroke: string = undefined, strokeWidth: string = undefined, strokeDashArray: string = undefined, markerEnd: string = undefined) {
    this.d = d;
    this.stroke = stroke || '#4A4A4A';
    this.strokeWidth = strokeWidth || '8';
    this.strokeDasharray = strokeDashArray || '10, 5';
    this.markerEnd = markerEnd || '';
  }
}

class EdgeModelXY extends EdgeModel {
  constructor(scx: number, scy: number, tcx: number, tcy: number, stroke: string = undefined, strokeWidth: string = undefined, strokeDashArray: string = undefined, markerEnd: string = undefined) {
    super(`M ${scx} ${scy} L ${tcx} ${tcy}`, stroke, strokeWidth, strokeDashArray, markerEnd);
  }
}

class HoverViewModel {
  bgEdges: EdgeModel[]
  nodes: NodeModel[]
  fgEdges: EdgeModel[]

  constructor() {
    this.bgEdges = [];
    this.nodes = [];
    this.fgEdges = [];
  }
}

export class MergeViewModel extends HoverViewModel {
  graph: any
  constructor(graph, headNode, node) {
    super();
    this.graph = graph;
    this.bgEdges = [
      new EdgeModelXY(headNode.cx(), headNode.cy() - 110, headNode.cx(), headNode.cy()),
      new EdgeModelXY(headNode.cx(), headNode.cy() - 110, node.cx(), node.cy()),
    ];
    this.nodes = [
      new NodeModel(
        headNode.cx(),
        headNode.cy() - 110,
        Math.max(headNode.r(), node.r()),
        '#252833',
        '#41DE3C',
        '8',
        '10, 5'
      ),
    ];

    graph.commitOpacity(0.1);
  }

  destroy() {
    this.graph.commitOpacity(1.0);
  }
}

export class RebaseViewModel extends HoverViewModel {
  constructor(onto, nodesThatWillMove) {
    super();
    nodesThatWillMove = nodesThatWillMove.slice(0, -1);

    if (nodesThatWillMove.length == 0) return;

    this.bgEdges.push(new EdgeModelXY(onto.cx(), onto.cy(), onto.cx(), onto.cy() - 60));
    nodesThatWillMove.forEach((node, i) => {
      const cy = onto.cy() + -90 * (i + 1);
      this.nodes.push(new NodeModel(onto.cx(), cy, 28, 'transparent'));
      if (i + 1 < nodesThatWillMove.length) {
        this.bgEdges.push(new EdgeModelXY(onto.cx(), cy - 25, onto.cx(), cy - 65));
      }
    });
  }
}

export class ResetViewModel extends HoverViewModel {
  constructor(nodes) {
    super();
    nodes.forEach((node) => {
      this.fgEdges.push(
        new EdgeModel(node.getLeftToRightStrike(), 'rgb(255, 129, 31)', '8', '0, 0')
      );
      this.fgEdges.push(
        new EdgeModel(node.getRightToLeftStrike(), 'rgb(255, 129, 31)', '8', '0, 0')
      );
    });
  }
}

export class PushViewModel extends HoverViewModel {
  constructor(fromNode, toNode) {
    super();
    this.fgEdges = [
      new EdgeModelXY(
        fromNode.cx(),
        fromNode.cy(),
        toNode.cx(),
        toNode.cy() + 40,
        'rgb(61, 139, 255)',
        '15',
        '10, 5',
        'url(#pushArrowEnd)'
      ),
    ];
  }
}

export class SquashViewModel extends HoverViewModel {
  constructor(graph: any, from, onto) {
    super();
    let path = graph.nodesEdges.getPathToCommonAncestor(from, onto);

    if (path.length == 0) {
      return;
    } else if (path.length == 1) {
      path = graph.nodesEdges.getPathToCommonAncestor(onto, from);
    } else {
      this.nodes.push(new NodeModel(onto.cx(), onto.cy() - 120, 28, 'transparent'));
    }

    path.slice(0, -1).forEach((node) => {
      this.nodes.push(new NodeModel(node.cx(), node.cy(), node.r() + 2, 'rgba(100, 60, 222, 0.8)'));
    });
  }
}
