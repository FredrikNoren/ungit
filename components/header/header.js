
const ko = require('knockout');
const components = require('ungit-components');
const navigation = require('ungit-navigation');
const programEvents = require('ungit-program-events');

components.register('header', args => new HeaderViewModel(args.app));

class HeaderViewModel {
  constructor(app) {
    this.app = app;
    this.showBackButton = ko.observable(false);
    this.path = ko.observable();
    this.currentVersion = ungit.version;
    this.refreshButton = components.create('refreshbutton');
    this.showAddToRepoListButton = ko.computed(() => this.path() && !this.app.repoList().includes(this.path()));
  }

  updateNode(parentElement) {
    ko.renderTemplate('header', this, {}, parentElement);
  }

  submitPath() {
    navigation.browseTo(`repository?path=${encodeURIComponent(this.path())}`);
  }

  onProgramEvent(event) {
    if (event.event == 'navigation-changed') {
      this.showBackButton(event.path != '');
      if (event.path == '') this.path('');
    } else if (event.event == 'navigated-to-path') {
      this.path(event.path);
    }
  }

  addCurrentPathToRepoList() {
    programEvents.dispatch({ event: 'request-remember-repo', repoPath: this.path() });
    return true;
  }
}
