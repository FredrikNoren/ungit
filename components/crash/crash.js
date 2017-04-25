
var ko = require('knockout');
var components = require('ungit-components');
var adBlocker = require('just-detect-adblock');

components.register('crash', function(err, err2) {
  return new LoginViewModel(err, err2);
});

var LoginViewModel = function(err, err2) {
  var self = this;
  if (adBlocker.isDetected()) {err='adblock'}
  this.eventcause = err || err2 || 'unknown error';
}

LoginViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('crash', this, {}, parentElement);
}
