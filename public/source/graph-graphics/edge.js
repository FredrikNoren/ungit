
var ko = require('../../vendor/js/knockout-2.2.1.js');
var Vector2 = require('../vector2');

var EdgeViewModel = function(nodea, nodeb) {
	var self = this;
	this.nodea = ko.observable(nodea);
	this.nodeb = ko.observable(nodeb);

	this.nodeAPosition = ko.computed(function() {
		if (self.nodea() && self.nodea().position()) {
			return self.nodea().position();
		} else {
			if (self.nodeb() && self.nodeb().position()) return self.nodeb().position().add(new Vector2(0, 10000));
			else return new Vector2(0, 0);
		}
	});

	this.nodeBPosition = ko.computed(function() {
		if (self.nodeb() && self.nodeb().position()) {
			return self.nodeb().position();
		} else {
			if (self.nodea() && self.nodea().position()) return self.nodea().position().add(new Vector2(0, 10000));
			else return new Vector2(0, 0);
		}
	});

	this.nodeARadius = ko.computed(function() { return self.nodea() ? self.nodea().outerRadius() : 30; })
	this.nodeBRadius = ko.computed(function() { return self.nodeb() ? self.nodeb().outerRadius() : 30; })
	
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