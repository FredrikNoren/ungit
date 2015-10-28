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
    // animate only when dom is valid and (attribute changed or force refresh due to dom change)
    if (this.element() && (forceRefresh || JSON.stringify(currentGraph) !== JSON.stringify(this.previousGraph))) {
      var now = Date.now();
      window.mina(this.previousGraph || currentGraph, currentGraph, now, now + 750, window.mina.time, function (val) {
        self.setGraphAttr(val);
      }, window.mina.elastic);
      this.previousGraph = currentGraph;
    }
  }
};
