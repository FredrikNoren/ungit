
var ko = require('knockout');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');

components.register('refreshbutton', function() {
  return new RefreshButton();
});

function RefreshButton() {}
RefreshButton.prototype.refresh = function() {
  programEvents.dispatch({ event: 'request-app-content-refresh' });
  return true;
}
RefreshButton.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('refreshbutton', this, {}, parentElement);
}
