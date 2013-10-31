var ko = require('../vendor/js/knockout-2.2.1.js');

Selectable = function(graph) {
    this.selected = ko.computed(function() {
        return graph.currentActionContext() == this;
    }, this);
    this.select = function() {
        graph.currentActionContext(this);
    };
};
exports.Selectable = Selectable;
