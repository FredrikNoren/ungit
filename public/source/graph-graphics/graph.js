
var ko = require('../../vendor/js/knockout-2.2.1.js');
var Vector2 = require('../vector2');
var NodeViewModel = require('./node').NodeViewModel;
var EdgeViewModel = require('./edge').EdgeViewModel;

var GraphViewModel = function() {
	var self = this;
	this.nodes = ko.observable([]);
	this.commitNode = new CommitNodeViewModel(this);
	this.commitNodeEdge = new EdgeViewModel(this.commitNode);
	this.graphWidth = ko.computed(function() {
		var width = 0;
		self.nodes().forEach(function(node) {
			width = Math.max(width, node.x() + node.radius() + 205);
		});
		return width;
	});
	this.graphHeight = ko.computed(function() {
		var nodes = self.nodes();
		if (nodes.length == 0) return 200;
		return nodes[nodes.length - 1].y() + nodes[nodes.length - 1].radius() + 200;
	});
	this.edges = ko.observable();
	this.showCommitNode = ko.observable();

	this.hoverGraphActionGraphic = ko.observable();
	this.hoverGraphActionGraphicType = ko.computed(function() {
		return self.hoverGraphActionGraphic() ? self.hoverGraphActionGraphic().type : '';
	})
}
exports.GraphViewModel = GraphViewModel;
GraphViewModel.prototype.updateAnimationFrame = function(deltaT) {
	if (this.hoverGraphActionGraphic()) {
		this.hoverGraphActionGraphic().updateAnimationFrame(deltaT);
	}
}

var CommitNodeViewModel = function(graph) {
	this.position = ko.observable(new Vector2(30, 30));
	this.radius = ko.observable(28);
	this.outerRadius = ko.observable(32);
	//this.color = ko.computed(function() { return graph.HEAD() && graph.HEAD().ideologicalBranch() ? graph.HEAD().ideologicalBranch().color : '#666' });
	this.color = ko.observable('#ff00ff')
}