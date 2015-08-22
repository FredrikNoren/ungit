var ko = require('knockout');

var EdgeViewModel = function(nodea, nodeb) {
  var self = this;
  this.nodea = ko.observable(nodea);
  this.nodeb = ko.observable(nodeb);
  this.x = undefined;
  this.y = undefined;
  this.width = 10;
  this.height = 80;
  
  this.updateLocation();
}
module.exports = EdgeViewModel;

EdgeViewModel.prototype.updateLocation = function() {
  if (!this.nodea()) {
    this.x = 607;
    this.y = 120;
  } else if (!this.nodeb()) {
    this.x = this.nodea().cx - 4;
    this.y = this.nodea().cy + 20;
  } else {
    this.x = this.nodea().cx - 4;
    this.y = this.nodea().cy + 20;
  }
  console.log(this.x, this.y);
}
