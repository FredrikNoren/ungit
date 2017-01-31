
var ko = require('knockout');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');
var navigation = require('ungit-navigation');

components.register('gitErrors', function(args) {
  return new GitErrorsViewModel(args.server, args.repoPath);
});

var GitErrorsViewModel = function(server, repoPath) {
  var self = this;
  this.server = server;
  this.repoPath = repoPath;
  this.gitErrors = ko.observableArray();
}
GitErrorsViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('gitErrors', this, {}, parentElement);
}
GitErrorsViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'git-error') this._handleGitError(event);
}
GitErrorsViewModel.prototype._handleGitError = function(event) {
  if (event.data.repoPath != this.repoPath()) return;
  this.gitErrors.push(new GitErrorViewModel(this, this.server, event.data));
}

function GitErrorViewModel(gitErrors, server, data) {
  var self = this;
  this.gitErrors = gitErrors;
  this.server = server;
  this.tip = data.tip;
  this.command = data.command;
  this.error = data.error;
  this.stdout = data.stdout;
  this.stderr = data.stderr;
  this.showEnableBugtracking = ko.observable(false);
  this.bugReportWasSent = ungit.config.bugtracking;

  if (!data.shouldSkipReport && !ungit.config.bugtracking) {
    this.server.getPromise('/userconfig')
      .then(function(userConfig) { self.showEnableBugtracking(!userConfig.bugtracking); })
      .catch(function(err) {});
  }
}
GitErrorViewModel.prototype.dismiss = function() {
  this.gitErrors.gitErrors.remove(this);
}
GitErrorViewModel.prototype.enableBugtrackingAndStatistics = function() {
  var self = this;
  this.server.getPromise('/userconfig')
    .then(function(userConfig) {
      userConfig.bugtracking = true;
      userConfig.sendUsageStatistics = true;
      return self.server.postPromise('/userconfig', userConfig)
        .then(function() { self.showEnableBugtracking(false); })
    }).catch(function(err) {});
}
