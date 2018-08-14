
var ko = require('knockout');
var components = require('ungit-components');
var adBlocker = require('just-detect-adblock');

components.register('crash', function(err, err2) {
  return new CrashViewModel(err, err2);
});

var CrashViewModel = function(err, err2) {
  if (adBlocker.isDetected()) {err='adblock'}
  this.eventcause = err || err2 || 'unknown error';
}

CrashViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('crash', this, {}, parentElement);
}
