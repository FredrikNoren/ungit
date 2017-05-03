
var ko = require('knockout');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');
var navigation = require('ungit-navigation');

components.register('app', function(args) {
  return new AppViewModel(args.appContainer, args.server);
});

var AppViewModel = function(appContainer, server) {
  var self = this;
  this.appContainer = appContainer;
  this.server = server;
  if (window.location.search.indexOf('noheader=true') < 0)
    this.header = components.create('header', { app: this });
  this.dialog = ko.observable(null);

  this.repoList = ko.observableArray(JSON.parse(localStorage.getItem('repositories') || localStorage.getItem('visitedRepositories') || '[]')); // visitedRepositories is legacy, remove in the next version
  this.repoList.subscribe(function(newValue) { localStorage.setItem('repositories', JSON.stringify(newValue)); });

  this.content = ko.observable(components.create('home', { app: this }));
  this.currentVersion = ko.observable();
  this.latestVersion = ko.observable();
  this.showNewVersionAvailable = ko.observable();
  this.newVersionInstallCommand = (ungit.platform == 'win32' ? '' : 'sudo -H ') + 'npm update -g ungit';
  this.bugtrackingEnabled = ko.observable(ungit.config.bugtracking);

  this.bugtrackingNagscreenDismissed = ko.observable(localStorage.getItem('bugtrackingNagscreenDismissed'));
  this.showBugtrackingNagscreen = ko.computed(function() {
    return !self.bugtrackingEnabled() && !self.bugtrackingNagscreenDismissed();
  });

  this.gitVersionErrorDismissed = ko.observable(localStorage.getItem('gitVersionErrorDismissed'));
  this.gitVersionError = ko.observable();
  this.gitVersionErrorVisible = ko.computed(function() {
    return !ungit.config.gitVersionCheckOverride && self.gitVersionError() && !self.gitVersionErrorDismissed();
  });

  var NPSSurveyLastDismissed = parseInt(localStorage.getItem('NPSSurveyLastDismissed') || '0');
  var monthsSinceNPSLastDismissed = (Date.now() - NPSSurveyLastDismissed) / (1000 * 60 * 60 * 24 * 30);
  this.showNPSSurvey = ko.observable(monthsSinceNPSLastDismissed >= 6 && Math.random() < 0.01);
  this.sendNPS = function(value) {
    keen.addEvent('survey-nps', {
      version: ungit.version,
      userHash: ungit.userHash,
      rating: value,
      bugtrackingEnabled: ungit.config.bugtracking,
      sendUsageStatistics: ungit.config.sendUsageStatistics
    });
    self.dismissNPSSurvey();
  }

}

AppViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('app', this, {}, parentElement);
}
AppViewModel.prototype.template = 'app';
AppViewModel.prototype.shown = function() {
  var self = this;
  // The ungit.config variable collections configuration from all different paths and only updates when
  // ungit is restarted
  if(!ungit.config.bugtracking) {
    // Whereas the userconfig only reflects what's in the ~/.ungitrc and updates directly,
    // but is only used for changing around the configuration. We need to check this here
    // since ungit may have crashed without the server crashing since we enabled bugtracking,
    // and we don't want to show the nagscreen twice in that case.
    this.server.getPromise('/userconfig')
      .then(function(userConfig) { self.bugtrackingEnabled(userConfig.bugtracking); });
  }

  this.server.getPromise('/latestversion')
    .then(function(version) {
      if (!version) return;
      self.currentVersion(version.currentVersion);
      self.latestVersion(version.latestVersion);
      self.showNewVersionAvailable(!ungit.config.ungitVersionCheckOverride && version.outdated);
    });
  this.server.getPromise('/gitversion')
    .then(function(gitversion) {
      if (gitversion && !gitversion.satisfied) {
        self.gitVersionError(gitversion.error);
      }
    });
}
AppViewModel.prototype.updateAnimationFrame = function(deltaT) {
  if (this.content() && this.content().updateAnimationFrame) this.content().updateAnimationFrame(deltaT);
}
AppViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'request-credentials') this._handleCredentialsRequested(event);
  else if (event.event == 'request-show-dialog') this.showDialog(event.dialog);
  else if (event.event == 'request-remember-repo') this._handleRequestRememberRepo(event);

  if (this.content() && this.content().onProgramEvent)
    this.content().onProgramEvent(event);
  if (this.header && this.header.onProgramEvent) this.header.onProgramEvent(event);
}
AppViewModel.prototype._handleRequestRememberRepo = function(event) {
  var repoPath = event.repoPath;
  if (this.repoList.indexOf(repoPath) != -1) return;
  this.repoList.push(repoPath);
}
AppViewModel.prototype._handleCredentialsRequested = function() {
  var self = this;
  // Only show one credentials dialog if we're asked to show another one while the first one is open
  // This happens for instance when we fetch nodes and remote tags at the same time
  if (!this._isShowingCredentialsDialog) {
    this._isShowingCredentialsDialog = true;
    components.create('credentialsdialog').show().closeThen(function(diag) {
      self._isShowingCredentialsDialog = false;
      programEvents.dispatch({ event: 'request-credentials-response', username: diag.username(), password: diag.password() });
    });
  }
}
AppViewModel.prototype.showDialog = function(dialog) {
  var self = this;
  this.dialog(dialog.closeThen(function() {
    self.dialog(null);
    return dialog;
  }));
}
AppViewModel.prototype.gitSetUserConfig = function(bugTracking, sendUsageStatistics) {
  var self = this;
  this.server.getPromise('/userconfig')
    .then(function(userConfig) {
      userConfig.bugtracking = bugTracking;
      if (sendUsageStatistics != undefined) userConfig.sendUsageStatistics = sendUsageStatistics;
      return self.server.postPromise('/userconfig', userConfig)
        .then(function() { self.bugtrackingEnabled(bugTracking); });
    }).catch(function(err) { })
}
AppViewModel.prototype.enableBugtrackingAndStatistics = function() {
  this.gitSetUserConfig(true, true);
}
AppViewModel.prototype.enableBugtracking = function() {
  this.gitSetUserConfig(true);
}
AppViewModel.prototype.dismissBugtrackingNagscreen = function() {
  localStorage.setItem('bugtrackingNagscreenDismissed', true);
  this.bugtrackingNagscreenDismissed(true);
}
AppViewModel.prototype.dismissGitVersionError = function() {
  localStorage.setItem('gitVersionErrorDismissed', true);
  this.gitVersionErrorDismissed(true);
}
AppViewModel.prototype.dismissNPSSurvey = function() {
  this.showNPSSurvey(false);
  localStorage.setItem('NPSSurveyLastDismissed', Date.now());
}
AppViewModel.prototype.dismissNewVersion = function() {
  this.showNewVersionAvailable(false);
}
AppViewModel.prototype.templateChooser = function(data) {
  if (!data) return '';
  return data.template;
};
