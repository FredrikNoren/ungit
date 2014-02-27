
var ko = require('knockout');
var Vector2 = require('ungit-vector2');

var EdgeViewModel = function(nodea, nodeb) {
  var self = this;
  this.nodea = ko.observable(nodea);
  this.nodeb = ko.observable(nodeb);
  this.x1 = ko.observable();
  this.x2 = ko.observable();
  this.y1 = ko.observable();
  this.y2 = ko.observable();
  this.updateAnimationFrame();
}
exports.EdgeViewModel = EdgeViewModel;
EdgeViewModel.prototype._getNodePosition = function(node, fallbackNode) {
  if (node && node.position()) {
    return node.position();
  } else {
    if (fallbackNode && fallbackNode.position()) return fallbackNode.position().add(new Vector2(0, 10000));
    else return new Vector2(0, 0);
  }
}
EdgeViewModel.prototype._getNodeRadius = function(node) {
  return (node ? node.outerRadius() : null) || 30;
}
EdgeViewModel.prototype.updateAnimationFrame = function(deltaT) {
  var a = this._getNodePosition(this.nodea(), this.nodeb());
  var b = this._getNodePosition(this.nodeb(), this.nodea());
  var d = b.sub(a);
  if (d.length() == 0) {
    this.x1(a.x);
    this.y1(a.y);
    this.x2(a.x);
    this.y2(a.y);
    return;
  }
  d = d.normalize();
  var p1 = a.add(d.mul(this._getNodeRadius(this.nodea()) + 2));
  var p2 = b.sub(d.mul(this._getNodeRadius(this.nodeb()) + 2));
  this.x1(p1.x);
  this.y1(p1.y);
  this.x2(p2.x);
  this.y2(p2.y);
}