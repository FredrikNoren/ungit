var ko = require('knockout');

var EdgeViewModel = function(nodea, nodeb) {
  var self = this;
  this.nodea = ko.observable(nodea);
  this.nodeb = ko.observable(nodeb);
  this.x = undefined;
  this.y = undefined;
  this.width = undefined;
  this.height = undefined;
  
  this.updateLocation();
}
module.exports = EdgeViewModel;

EdgeViewModel.prototype.updateLocation = function() {
  this.width = 10;
  this.height = 50;
  
  if (!this.nodea()) {
    this.x = 613;
    this.y = 120;
  } else if (!this.nodeb()) {
    this.x = this.nodea().cx;
    this.y = this.nodea().cy;
  } else {
    this.x = this.nodea().cx - this.nodeb().cx + 613;
    this.y = this.nodea().cy - this.nodeb().cy + 120;
  }
}
