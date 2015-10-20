var ko = require('knockout');
var Snap = require('snapsvg');

module.exports = function(graph) {
  var self = this;
  this.element = ko.observable();
  this.animationQueued = false;
  this.graphic = undefined;
  this.previousGraph = undefined;
  this.element.subscribe(function(val) {
    if (val) {
      self.graphic = Snap._.wrap(val);
      if (self.animationQueued) {
        self.graphic.animate(self.getGraphAttr(), 750, mina.elastic);
        self.animationQueued = false;
      }
    } else {
      self.graphic.remove();
      self.graphic = null;
    }
  });
  this.animate = function() {
    var currentGraph = this.getGraphAttr();
    // animate only when attribute changed
    if (JSON.stringify(currentGraph) !== JSON.stringify(this.previousGraph)) {
      this.previousGraph = currentGraph;
      if (this.graphic) {
        this.graphic.animate(currentGraph, 750, mina.elastic);
      } else {
        this.animationQueued = true;
      }
    }
  }
};
