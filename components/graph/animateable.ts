import * as ko from 'knockout';
import { Selectable } from './selectable';

declare const ungit: any;

require('mina');

export abstract class Animateable extends Selectable {
  element: ko.Observable<HTMLElement>
  previousGraph: number[]
  getGraphAttr: ko.Computed<number[]>

  constructor(graph) {
    super(graph);
    this.previousGraph = undefined;
    this.element = ko.observable();
    this.element.subscribe((val) => {
      if (val) this.animate(true);
    });
  }

  abstract setGraphAttr(val: number[]): void

  animate(forceRefresh: boolean = false) {
    const currentGraph = this.getGraphAttr();
    if (
      this.element() &&
      (forceRefresh || JSON.stringify(currentGraph) !== JSON.stringify(this.previousGraph))
    ) {
      // dom is valid and force refresh is requested or dom moved, redraw
      if (ungit.config.isAnimate && !this.graph.isBigRepo()) {
        const now = Date.now();
        (window as any).mina(
          this.previousGraph || currentGraph,
          currentGraph,
          now,
          now + 750,
          (window as any).mina.time,
          (val) => {
            this.setGraphAttr(val);
          },
          (window as any).mina.elastic
        );
      } else {
        this.setGraphAttr(currentGraph);
      }
      this.previousGraph = currentGraph;
    }
  }
}
