var ko = require('knockout');
require('mina');

module.exports = function(graph) {
  var self = this;
  this.element = ko.observable();
  this.previousGraph = undefined;
  this.element.subscribe(function(val) {
    if (val) self.animate(true);
  });
  this.animate = function(forceRefresh) {
    var currentGraph = this.getGraphAttr();
    if (this.element() && (forceRefresh || JSON.stringify(currentGraph) !== JSON.stringify(this.previousGraph))) {
      // dom is valid and force refresh is requested or dom moved, redraw
      if (ungit.config.isAnimate) {
        var now = Date.now();
        window.mina(this.previousGraph || currentGraph, currentGraph, now, now + 750, window.mina.time, function (val) {
          self.setGraphAttr(val);
        }, window.mina.elastic);
      } else {
        this.setGraphAttr(currentGraph);
      }
      this.previousGraph = currentGraph;
    }
  }
};
