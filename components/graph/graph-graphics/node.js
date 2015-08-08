
var ko = require('knockout');
var Vector2 = require('ungit-vector2');

var NodeViewModel = function(position, radius) {
  var self = this;
  this.position = ko.observable(position);
  this.goalPosition = this.position;
  this.isAtFinalXPosition = ko.computed(function() {
    if (!self.goalPosition() || !self.position()) return true;
    return self.position().x == self.goalPosition().x;
  });
  this.x = ko.computed(function() { return self.position() ? self.position().x : 0; });
  this.y = ko.computed(function() { return self.position() ? self.position().y : 0; });
  this.radius = ko.observable(radius || 30);
  this.outerRadius = this.radius;
  this.goalRadius = ko.observable(radius);
  this.animationSpeed = 0.4;
  this.color = ko.observable('#ff00ff');
  this.selected = ko.observable(false);
}
exports.NodeViewModel = NodeViewModel;
NodeViewModel.prototype.setPosition = function(position) {
  this.position(position);
}
NodeViewModel.prototype.setRadius = function(radius) {
  this.prevRadius = this.radius();
  if (!this.goalRadius()) this.radius(radius);
  this.goalRadius(radius);
  this.setRadiusTimestamp = Date.now();
}
