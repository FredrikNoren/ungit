
var ko = require('knockout');
var components = require('ungit-components');

components.register('sidebysidediff', function(args) {
  return new SideBySideDiffViewModel(args);
});

var SideBySideDiffViewModel = function(args) {
}

SideBySideDiffViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('sidebysidediff', this, {}, parentElement);
}

SideBySideDiffViewModel.prototype.invalidateDiff = function(callback) {
  var self = this;

  if (callback) callback();
}
