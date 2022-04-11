import * as ko from 'knockout';
import { AbstractGraph } from './abstract-graph';

export abstract class Selectable {
  graph: AbstractGraph
  selected: ko.Computed

  constructor(graph) {
    this.graph = graph
    this.selected = ko.pureComputed({
      read() {
        return graph.currentActionContext() == this;
      },
      write(val) {
        // val is this if we're called from a click ko binding
        if ((val === this || val === true) && graph.currentActionContext() !== this) {
          graph.currentActionContext(this);
        } else if (graph.currentActionContext() === this) {
          graph.currentActionContext(null);
        }
      },
      owner: this,
    });
  }
}
