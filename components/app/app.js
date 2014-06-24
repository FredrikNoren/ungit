
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

  this.repoList = ko.observable(JSON.parse(localStorage.getItem('repositories') || localStorage.getItem('visitedRepositories') || '[]')); // visitedRepositories is legacy, remove in the next version
  this.repoList.subscribe(function(newValue) { localStorage.setItem('repositories', JSON.stringify(newValue)); });
  
  this.content = ko.observable(components.create('home', { app: this }));
  this.currentVersion = ko.observable();
  this.latestVersion = ko.observable();
  this.newVersionAvailable = ko.observable();
  this.newVersionInstallCommand = (ungit.platform == 'win32' ? '' : 'sudo -H ') + 'npm update -g ungit';
  this.bugtrackingEnabled = ko.observable(ungit.config.bugtracking);

  this.bugtrackingNagscreenDismissed = ko.computed({
    read: function() { return localStorage.getItem('bugtrackingNagscreenDismissed'); },
    write: function(value) { localStorage.setItem('bugtrackingNagscreenDismissed', value); }
  })
  this.showBugtrackingNagscreen = ko.computed(function() {
    return !self.bugtrackingEnabled() && !self.bugtrackingNagscreenDismissed();
  });

  var NPSSurveyLastDismissed = parseInt(localStorage.getItem('NPSSurveyLastDismissed') || '0');
  var monthsSinceNPSLastDismissed = (Date.now() - NPSSurveyLastDismissed) / (1000 * 60 * 60 * 24 * 30);
  this.showNPSSurvey = ko.observable(monthsSinceNPSLastDismissed >= 6 && Math.random() < 0.01);
  this.sendNPS = function(value) {
    Keen.addEvent('survey-nps', {
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
    this.server.get('/userconfig', undefined, function(err, userConfig) {
      self.bugtrackingEnabled(userConfig.bugtracking);
    });
  }

  this.server.get('/latestversion', undefined, function(err, version) {
    self.currentVersion(version.currentVersion);
    self.latestVersion(version.latestVersion);
    self.newVersionAvailable(version.outdated);
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
  var repos = this.repoList();
  if (repos.indexOf(repoPath) != -1) return;
  repos.push(repoPath);
  this.repoList(repos);
}
AppViewModel.prototype._handleCredentialsRequested = function() {
  var self = this;
  var diag;
  // Only show one credentials dialog if we're asked to show another one while the first one is open
  // This happens for instance when we fetch nodes and remote tags at the same time
  if (this._isShowingCredentialsDialog)
    diag = self.dialog();
  else {
    diag = components.create('credentialsdialog');
    self.showDialog(diag);
  }
  this._isShowingCredentialsDialog = true;
  diag.closed.add(function() {
    self._isShowingCredentialsDialog = false;
    programEvents.dispatch({ event: 'request-credentials-response', username: diag.username(), password: diag.password() });
  });
}
AppViewModel.prototype.showDialog = function(dialog) {
  var self = this;
  dialog.closed.add(function() {
    self.dialog(null);
  })
  this.dialog(dialog);
}
AppViewModel.prototype.enableBugtrackingAndStatistics = function() {
  var self = this;
  this.server.get('/userconfig', undefined, function(err, userConfig) {
    if (err) return;
    userConfig.bugtracking = true;
    userConfig.sendUsageStatistics = true;
    self.server.post('/userconfig', userConfig, function(err) {
      if (err) return;
      self.bugtrackingEnabled(true);
    });
  });
}
AppViewModel.prototype.enableBugtracking = function() {
  var self = this;
  this.server.get('/userconfig', undefined, function(err, userConfig) {
    if (err) return;
    userConfig.bugtracking = true;
    self.server.post('/userconfig', userConfig, function(err) {
      if (err) return;
      self.bugtrackingEnabled(true);
    });
  });
}
AppViewModel.prototype.dismissBugtrackingNagscreen = function() {
  this.bugtrackingNagscreenDismissed(true);
}
AppViewModel.prototype.dismissNPSSurvey = function() {
  this.showNPSSurvey(false);
  localStorage.setItem('NPSSurveyLastDismissed', Date.now());
}
AppViewModel.prototype.templateChooser = function(data) {
  if (!data) return '';
  return data.template;
};



