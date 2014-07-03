
var ko = require('knockout');
var components = require('ungit-components');
var navigation = require('ungit-navigation');
var programEvents = require('ungit-program-events');

components.register('header', function(args) {
  return new HeaderViewModel(args.app);
});

function HeaderViewModel(app) {
  var self = this;
  this.app = app;
  this.showBackButton = ko.observable(false);
  this.path = ko.observable();
  this.currentVersion = ungit.version;
  this.showAddToRepoListButton = ko.computed(function() {
    return self.path() && self.app.repoList().indexOf(self.path()) == -1;
  });
  this.refreshingProgressBar = components.create('progressBar', { predictionMemoryKey: 'refreshing-content', temporary: true });
}
HeaderViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('header', this, {}, parentElement);
}
HeaderViewModel.prototype.submitPath = function() {
  navigation.browseTo('repository?path=' + encodeURIComponent(this.path()));
}
HeaderViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'navigation-changed') {
    this.showBackButton(event.path != '');
    if (event.path == '') this.path('');
  } else if (event.event == 'navigated-to-path') {
    this.path(event.path);
  }
}
HeaderViewModel.prototype.addCurrentPathToRepoList = function() {
  programEvents.dispatch({ event: 'request-remember-repo', repoPath: this.path() });
  return true;
}
HeaderViewModel.prototype.refresh = function() {
  var self = this;
  programEvents.dispatch({ event: 'request-app-content-refresh' });
  this.refreshingProgressBar.start();
  setTimeout(function() { // Fake the progress bar, for now (since we don't really know who and when this message will be handled)
    self.refreshingProgressBar.stop();
  }, 100);
  return true;
}
