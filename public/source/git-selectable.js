var ko = require('../vendor/js/knockout-2.2.1.js');
var _ = require('lodash');

var Selectable = function(graph) {
    this.selected = ko.computed({
        read: function() {
            return graph.currentActionContext() == this;
        },
        write: function(val) {
            // val is this if we're called from a click ko binding
            if (val === this || val === true) {
                graph.currentActionContext(this);
            } else if (graph.currentActionContext() == this) {
                graph.currentActionContext(null);
            }
        },
        owner: this
    });
};
exports.Selectable = Selectable;
