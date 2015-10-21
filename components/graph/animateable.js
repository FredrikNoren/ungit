var ko = require('knockout');
var Snap = require('snapsvg');

module.exports = function(graph) {
  var self = this;
  this.element = ko.observable();
  this.previousGraph = undefined;
  this.element.subscribe(function(val) {
    if (val) self.animate(true);
  });
  this.animate = function(forceRefresh) {
    var currentGraph = this.getGraphAttr();
    // animate only when dom is valid and (attribute changed or force refresh due to dom change)
    if (this.element() && (forceRefresh || JSON.stringify(currentGraph) !== JSON.stringify(this.previousGraph))) {
      var now = Date.now();
      mina(this.previousGraph || currentGraph, currentGraph, now, now + 750, mina.time, function (val) {
        self.setGraphAttr(val);
      }, mina.elastic);
      this.previousGraph = currentGraph;
    }
  }
};
