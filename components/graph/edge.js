const ko = require('knockout');
const Animateable = require('./animateable');

class EdgeViewModel extends Animateable {
  constructor(graph, nodeAsha1, nodeBsha1) {
    super(graph);
    this.nodeA = graph.getNode(nodeAsha1);
    this.nodeB = graph.getNode(nodeBsha1);
    this.getGraphAttr = ko.computed(() => {
      if (this.nodeA.cx() && this.nodeA.cy()) {
        if (this.nodeB.cx() && this.nodeB.cy()) {
          return [
            this.nodeA.cx(),
            this.nodeA.cy(),
            this.nodeA.cx(),
            this.nodeA.cy(),
            this.nodeB.cx(),
            this.nodeB.cy(),
            this.nodeB.cx(),
            this.nodeB.cy(),
          ];
        }
      } else {
        return [0, 0, 0, 0, 0, 0, 0, 0];
      }
    });
    this.getGraphAttr.subscribe(this.animate.bind(this));
  }

  setGraphAttr(val) {
    this.element().setAttribute('d', `M${val.slice(0, 4).join(',')}L${val.slice(4, 8).join(',')}`);
    this.element().setAttribute('stroke', this.nodeA.color());
  }

  edgeMouseOver() {
    if (this.nodeA) {
      this.nodeA.isEdgeHighlighted(true);
    }
    if (this.nodeB) {
      this.nodeB.isEdgeHighlighted(true);
    }
  }

  edgeMouseOut() {
    if (this.nodeA) {
      this.nodeA.isEdgeHighlighted(false);
    }
    if (this.nodeB) {
      this.nodeB.isEdgeHighlighted(false);
    }
  }
}

module.exports = EdgeViewModel;
