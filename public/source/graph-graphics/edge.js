
var ko = require('../../vendor/js/knockout-2.2.1.js');
var Vector2 = require('../vector2');

var EdgeViewModel = function(nodea, nodeb) {
	var self = this;
	this.nodea = ko.observable(nodea);
	this.nodeb = ko.observable(nodeb);

	var getNodePosition = function(node, fallbackNode) {
		if (node && node.position()) {
			return node.position();
		} else {
			if (fallbackNode && fallbackNode.position()) return fallbackNode.position().add(new Vector2(0, 10000));
			else return new Vector2(0, 0);
		}
	}
	var getNodeRadius = function(node) {
		return (node ? node.outerRadius() : null) || 30;
	}

	this.nodeAPosition = ko.computed(function() { return getNodePosition(self.nodea(), self.nodeb()); });
	this.nodeBPosition = ko.computed(function() { return getNodePosition(self.nodeb(), self.nodea()); });

	this.nodeARadius = ko.computed(function() { return getNodeRadius(self.nodea()); })
	this.nodeBRadius = ko.computed(function() { return getNodeRadius(self.nodeb()); })
	
	this.delta = ko.computed(function() {
		return self.nodeBPosition().sub(self.nodeAPosition()).normalized();
	});

	this.posA = ko.computed(function() {
		return self.nodeAPosition().add(self.delta().mul(self.nodeARadius() + 2));
	});
	this.posB = ko.computed(function() {
		return self.nodeBPosition().sub(self.delta().mul(self.nodeBRadius() + 2));
	});
}
exports.EdgeViewModel = EdgeViewModel;