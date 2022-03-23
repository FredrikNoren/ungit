import * as ko from 'knockout';
import { Animateable } from './animateable';
import { AbstractNode } from './abstract-node';

export class EdgeViewModel extends Animateable {
  nodeA: AbstractNode
  nodeB: AbstractNode
  constructor(graph: any, nodeAsha1: string, nodeBsha1: string) {
    super(graph);
    this.nodeA = graph.nodesEdges.getNode(nodeAsha1);
    this.nodeB = graph.nodesEdges.getNode(nodeBsha1);
    this.getGraphAttr = ko.computed(() => {
      if (this.nodeA.isViewable() && this.nodeB.isViewable()) {
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
      } else if (this.nodeA.isViewable() && !this.nodeB.isViewable()) {
        return [
          this.nodeA.cx(),
          this.nodeA.cy(),
          this.nodeA.cx(),
          this.nodeA.cy(),
          this.nodeA.cx(),
          graph.graphHeight(),
          this.nodeA.cx(),
          graph.graphHeight(),
        ];
      } else {
        return [0, 0, 0, 0, 0, 0, 0, 0];
      }
    }).extend({ rateLimit: { timeout: 250, method: 'notifyWhenChangesStop' } });
    this.getGraphAttr.subscribe(this.animate.bind(this));
  }

  isViewable() {
    return this.nodeA.isViewable() || this.nodeB.isViewable();
  }

  setGraphAttr(val: number[]) {
    this.element().setAttribute('d', `M${val.slice(0, 4).join(',')}L${val.slice(4, 8).join(',')}`);
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
