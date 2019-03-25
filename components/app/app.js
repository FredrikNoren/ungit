
const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const navigation = require('ungit-navigation');
const storage = require('ungit-storage');

components.register('app', (args) => {
  return new AppViewModel(args.appContainer, args.server);
});

class AppViewModel {
  constructor(appContainer, server) {
    this.appContainer = appContainer;
    this.server = server;
    this.template = 'app';
    if (window.location.search.indexOf('noheader=true') < 0) {
      this.header = components.create('header', { app: this });
    }
    this.dialog = ko.observable(null);
    this.repoList = ko.observableArray(this.getRepoList()); // visitedRepositories is legacy, remove in the next version
    this.repoList.subscribe((newValue) => { storage.setItem('repositories', JSON.stringify(newValue)); });
    this.content = ko.observable(components.create('home', { app: this }));
    this.currentVersion = ko.observable();
    this.latestVersion = ko.observable();
    this.showNewVersionAvailable = ko.observable();
    this.newVersionInstallCommand = (ungit.platform == 'win32' ? '' : 'sudo -H ') + 'npm update -g ungit';
    this.bugtrackingEnabled = ko.observable(ungit.config.bugtracking);
    this.bugtrackingNagscreenDismissed = ko.observable(storage.getItem('bugtrackingNagscreenDismissed'));
    this.showBugtrackingNagscreen = ko.computed(() => {
      return !this.bugtrackingEnabled() && !this.bugtrackingNagscreenDismissed();
    });
    this.gitVersionErrorDismissed = ko.observable(storage.getItem('gitVersionErrorDismissed'));
    this.gitVersionError = ko.observable();
    this.gitVersionErrorVisible = ko.computed(() => {
      return !ungit.config.gitVersionCheckOverride && this.gitVersionError() && !this.gitVersionErrorDismissed();
    });
  }
  getRepoList() {
    const localStorageRepo = JSON.parse(storage.getItem('repositories') || storage.getItem('visitedRepositories') || '[]');
    const newRepos = localStorageRepo.concat(ungit.config.defaultRepositories || [])
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
    storage.setItem('repositories', JSON.stringify(newRepos));
    return newRepos;
  }
  updateNode(parentElement) {
    ko.renderTemplate('app', this, {}, parentElement);
  }
  shown() {
    // The ungit.config constiable collections configuration from all different paths and only updates when
    // ungit is restarted
    if(!ungit.config.bugtracking) {
      // Whereas the userconfig only reflects what's in the ~/.ungitrc and updates directly,
      // but is only used for changing around the configuration. We need to check this here
      // since ungit may have crashed without the server crashing since we enabled bugtracking,
      // and we don't want to show the nagscreen twice in that case.
      this.server.getPromise('/userconfig')
        .then((userConfig) => this.bugtrackingEnabled(userConfig.bugtracking))
        .catch((e) => this.server.unhandledRejection(e));
    }

    this.server.getPromise('/latestversion')
      .then((version) => {
        if (!version) return;
        this.currentVersion(version.currentVersion);
        this.latestVersion(version.latestVersion);
        this.showNewVersionAvailable(!ungit.config.ungitVersionCheckOverride && version.outdated);
      }).catch((e) => this.server.unhandledRejection(e));
    this.server.getPromise('/gitversion')
      .then((gitversion) => {
        if (gitversion && !gitversion.satisfied) {
          this.gitVersionError(gitversion.error);
        }
      }).catch((e) => this.server.unhandledRejection(e));
  }
  updateAnimationFrame(deltaT) {
    if (this.content() && this.content().updateAnimationFrame) this.content().updateAnimationFrame(deltaT);
  }
  onProgramEvent(event) {
    if (event.event == 'request-credentials') this._handleCredentialsRequested(event);
    else if (event.event == 'request-show-dialog') this.showDialog(event.dialog);
    else if (event.event == 'request-remember-repo') this._handleRequestRememberRepo(event);

    if (this.content() && this.content().onProgramEvent)
      this.content().onProgramEvent(event);
    if (this.header && this.header.onProgramEvent) this.header.onProgramEvent(event);
  }
  _handleRequestRememberRepo(event) {
    const repoPath = event.repoPath;
    if (this.repoList.indexOf(repoPath) != -1) return;
    this.repoList.push(repoPath);
  }
  _handleCredentialsRequested(event) {
    // Only show one credentials dialog if we're asked to show another one while the first one is open
    // This happens for instance when we fetch nodes and remote tags at the same time
    if (!this._isShowingCredentialsDialog) {
      this._isShowingCredentialsDialog = true;
      components.create('credentialsdialog', {remote: event.remote}).show().closeThen((diag) => {
        this._isShowingCredentialsDialog = false;
        programEvents.dispatch({ event: 'request-credentials-response', username: diag.username(), password: diag.password() });
      });
    }
  }
  showDialog(dialog) {
    this.dialog(dialog.closeThen(() => {
      this.dialog(null);
      return dialog;
    }));
  }
  gitSetUserConfig(bugTracking) {
    this.server.getPromise('/userconfig')
      .then((userConfig) => {
        userConfig.bugtracking = bugTracking;
        return this.server.postPromise('/userconfig', userConfig)
          .then(() => { this.bugtrackingEnabled(bugTracking); });
      });
  }
  enableBugtracking() {
    this.gitSetUserConfig(true);
  }
  dismissBugtrackingNagscreen() {
    storage.setItem('bugtrackingNagscreenDismissed', true);
    this.bugtrackingNagscreenDismissed(true);
  }
  dismissGitVersionError() {
    storage.setItem('gitVersionErrorDismissed', true);
    this.gitVersionErrorDismissed(true);
  }
  dismissNewVersion() {
    this.showNewVersionAvailable(false);
  }
  templateChooser(data) {
    if (!data) return '';
    return data.template;
  }
}
