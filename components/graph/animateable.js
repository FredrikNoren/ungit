const ko = require('knockout');
const Selectable = require('./selectable');

require('mina');

class Animateable extends Selectable {
  constructor(graph) {
    super(graph);
    this.element = ko.observable();
    this.previousGraph = undefined;
    this.element.subscribe(val => {
      if (val) this.animate(true);
    });
    this.animate = (forceRefresh) => {
      const currentGraph = this.getGraphAttr();
      if (this.element() && (forceRefresh || JSON.stringify(currentGraph) !== JSON.stringify(this.previousGraph))) {
        // dom is valid and force refresh is requested or dom moved, redraw
        if (ungit.config.isAnimate) {
          const now = Date.now();
          window.mina(this.previousGraph || currentGraph, currentGraph, now, now + 750, window.mina.time, val => {
            this.setGraphAttr(val);
          }, window.mina.elastic);
        } else {
          this.setGraphAttr(currentGraph);
        }
        this.previousGraph = currentGraph;
      }
    }
  }
}
module.exports = Animateable;
