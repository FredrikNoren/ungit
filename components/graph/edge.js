var ko = require('knockout');

var EdgeViewModel = function(nodea, nodeb) {
  var self = this;
  this.nodea = ko.observable(nodea);
  this.nodeb = ko.observable(nodeb);
  this.path = undefined;
  
  this.updateLocation();
}
module.exports = EdgeViewModel;

EdgeViewModel.prototype.updateLocation = function() {
  var acx = 613;
  var acy = 120;

  if (this.nodea()) {
    acx = this.nodea().cx;
    acy = this.nodea().cy;
  }
  
  var bcx = acx;
  var bcy = bcy + 100;
  
  if (this.nodeb()) {
    bcx = this.nodeb().cx;
    bcy = this.nodeb().cy;
  }
  
  this.path = "M " + acx + " " + acy +  " L " + bcx + " " + bcy;
}
