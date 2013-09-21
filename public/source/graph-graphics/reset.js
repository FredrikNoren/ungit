
var ko = require('../../vendor/js/knockout-2.2.1.js');
var Vector2 = require('../vector2');
var NodeViewModel = require('./node').NodeViewModel;
var EdgeViewModel = require('./edge').EdgeViewModel;

var ResetViewModel = function(nodes) {
	this.nodes = nodes;
}
exports.ResetViewModel = ResetViewModel;
ResetViewModel.prototype.type = 'reset';