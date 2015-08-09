
var ko = require('knockout');
var Vector2 = require('ungit-vector2');

var NodeViewModel = function(position, radius) {
  var self = this;
  this.position = ko.observable(position);
  this.x = ko.computed(function() { return self.position() ? self.position().x : 0; });
  this.y = ko.computed(function() { return self.position() ? self.position().y : 0; });
  this.radius = ko.observable(radius || 30);
  this.outerRadius = this.radius;
  this.color = ko.observable('#ff00ff');
}
exports.NodeViewModel = NodeViewModel;
NodeViewModel.prototype.setPosition = function(position) {
  this.position(position);
}
NodeViewModel.prototype.setRadius = function(radius) {
  this.radius(radius);
}
