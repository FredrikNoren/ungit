
var ko = require('knockout');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');

components.register('errors', function(args) {
  var m = new ErrorsViewModel(args.server, args.repoPath);
  console.log(m);
  return m;
});

var ErrorsViewModel = function(server, repoPath) {
  var self = this;
  this.server = server;
  this.repoPath = repoPath;
  this.errors = ko.observableArray();
}
ErrorsViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('errors', this, {}, parentElement);
}
ErrorsViewModel.prototype.onProgramEvent = function(event) {
  console.log("1");
  if (event.event == 'error') this._handleError(event);
}
ErrorsViewModel.prototype._handleError = function(event) {
  this.errors.push(new ErrorViewModel(this, this.server, event.data));
}

function ErrorViewModel(errors, server, data) {
  var self = this;
  this.errors = errors;
  this.message = data.message;
  this.server = server;
  this.showEnableBugtracking = ko.observable(false);
  this.bugReportWasSent = ungit.config.bugtracking;

  if (!data.shouldSkipReport && !ungit.config.bugtracking) {
    this.server.get('/userconfig', undefined, function(err, userConfig) {
      if (err) return;
      self.showEnableBugtracking(!userConfig.bugtracking);
    });
  }
}
ErrorViewModel.prototype.dismiss = function() {
  this.errors.errors.remove(this);
}
ErrorViewModel.prototype.enableBugtrackingAndStatistics = function() {
  var self = this;
  this.server.get('/userconfig', undefined, function(err, userConfig) {
    if (err) return;
    userConfig.bugtracking = true;
    userConfig.sendUsageStatistics = true;
    self.server.post('/userconfig', userConfig, function(err) {
      if (err) return;
      self.showEnableBugtracking(false);
    });
  });
}
