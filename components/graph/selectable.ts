import * as ko from 'knockout';

export abstract class Selectable {
  graph: any
  selected: ko.Computed

  constructor(graph) {
    this.graph = graph
    if (!graph) {
      throw Error('>>>> 8881823')
    }
    this.selected = ko.computed({
      read() {
        return graph.currentActionContext() == this;
      },
      write(val) {
        // val is this if we're called from a click ko binding
        if (val === this || val === true) {
          graph.currentActionContext(this);
        } else if (graph.currentActionContext() == this) {
          graph.currentActionContext(null);
        }
      },
      owner: this,
    });
  }
}
