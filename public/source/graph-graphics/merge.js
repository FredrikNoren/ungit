
var ko = require('../../vendor/js/knockout-2.2.1.js');
var Vector2 = require('../vector2');
var NodeViewModel = require('./node').NodeViewModel;
var EdgeViewModel = require('./edge').EdgeViewModel;

var MergeViewModel = function(headNode, node) {
	var self = this;

	var newNode = {
		position: new Vector2(
			headNode.x() + headNode.radius() + ((node.x() + node.radius()) - (headNode.x() + headNode.radius())) / 2,
			Math.min(headNode.y(), node.y())),
		radius: Math.max(headNode.radius(), node.radius())
	};
	newNode.position.y -= newNode.radius*2;

	this.newNode = new NodeViewModel(newNode.position, newNode.radius);
	this.edges = [
		new EdgeViewModel(headNode, this.newNode),
		new EdgeViewModel(node, this.newNode)
	];
}
exports.MergeViewModel = MergeViewModel;
MergeViewModel.prototype.type = 'merge';