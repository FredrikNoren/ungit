
var ko = require('knockout');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');

components.register('refreshbutton', function() {
  return new RefreshButton();
});

function RefreshButton() {
  this.refreshingProgressBar = components.create('progressBar', { predictionMemoryKey: 'refreshing-content', temporary: true });
}
RefreshButton.prototype.refresh = function() {
  var self = this;
  programEvents.dispatch({ event: 'request-app-content-refresh' });
  this.refreshingProgressBar.start();
  setTimeout(function() { // Fake the progress bar, for now (since we don't really know who and when this message will be handled)
    self.refreshingProgressBar.stop();
  }, 100);
  return true;
}
RefreshButton.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('refreshbutton', this, {}, parentElement);
}
