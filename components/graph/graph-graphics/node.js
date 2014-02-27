
var ko = require('knockout');
var Vector2 = require('ungit-vector2');

var NodeViewModel = function(position, radius) {
  var self = this;
  this.position = ko.observable(position);
  this.goalPosition = ko.observable(position);
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
  var self = this;
  this.prevPosition = self.position();
  if (!self.goalPosition()) self.position(position);
  self.goalPosition(position);
}
NodeViewModel.prototype.setRadius = function(radius) {
  this.prevRadius = this.radius();
  if (!this.goalRadius()) this.radius(radius);
  this.goalRadius(radius);
  this.setRadiusTimestamp = Date.now();
}
NodeViewModel.prototype.updateAnimationFrame = function(deltaT) {
  var totalTime = 500;

  var d = this.goalPosition().sub(this.position() || new Vector2(0, 0));
  var distanceLeft = d.length();
  if (distanceLeft != 0) {

    d = this.goalPosition().sub(this.prevPosition || new Vector2(0, 0));

    var totalLength = d.length();
    var lengthToMove = deltaT * this.animationSpeed;
    if (distanceLeft < lengthToMove) {
      this.position(this.goalPosition());
    } else {
      d = d.normalize().mul(lengthToMove);

      var pos = (this.position() || new Vector2(0, 0)).add(d);
      this.position(pos);
    }
  }

  var radiusLeft = this.goalRadius() - this.radius();
  if (radiusLeft != 0) {
    var sign = radiusLeft ? radiusLeft < 0 ? -1 : 1 : 0;
    radiusLeft = Math.abs(radiusLeft);
    var totalRadiusDiff = Math.abs(this.goalRadius() - this.prevRadius);
    var radiusToChange = totalRadiusDiff * deltaT / totalTime;
    if (radiusLeft < radiusToChange) {
      this.radius(this.goalRadius());
    } else {
      this.radius(this.radius() + sign * radiusToChange);
    }
  }
}
