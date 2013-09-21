
var ko = require('../../vendor/js/knockout-2.2.1.js');

PushViewModel = function(fromNode, toNode) {
	this.fromNode = fromNode;
	this.toNode = toNode;
}
exports.PushViewModel = PushViewModel;
PushViewModel.prototype.type = 'push';