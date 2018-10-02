
const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');

components.register('submodules', args => new SubmodulesViewModel(args.server, args.repoPath));

class SubmodulesViewModel {
  constructor(server, repoPath) {
    this.repoPath = repoPath;
    this.server = server;
    this.submodules = ko.observableArray();
    this.isUpdating = false;
  }

  onProgramEvent(event) {
    if (event.event == 'submodule-fetch') this.fetchSubmodules();
  }

  updateNode(parentElement) {
    this.fetchSubmodules().then(submoduleViewModel => {
      ko.renderTemplate('submodules', submoduleViewModel, {}, parentElement);
    });
  }

  fetchSubmodules() {
    return this.server.getPromise('/submodules', { path: this.repoPath() })
      .then(submodules => {
        this.submodules(submodules && Array.isArray(submodules) ? submodules : []);
        return this;
      }).catch((e) => this.server.unhandledRejection(e));
  }

  updateSubmodules() {
    if (this.isUpdating) return;
    this.isUpdating = true;
    return this.server.postPromise('/submodules/update', { path: this.repoPath() })
      .catch((e) => this.server.unhandledRejection(e))
      .finally(() => { this.isUpdating = false; });
  }

  showAddSubmoduleDialog() {
    components.create('addsubmoduledialog')
      .show()
      .closeThen((diag) => {
        if (!diag.isSubmitted()) return;
        this.isUpdating = true;
        this.server.postPromise('/submodules/add', { path: this.repoPath(), submoduleUrl: diag.url(), submodulePath: diag.path() })
          .then(() => { programEvents.dispatch({ event: 'submodule-fetch' }); })
          .catch((e) => this.server.unhandledRejection(e))
          .finally(() => { this.isUpdating = false; });
      });
  }

  submoduleLinkClick(submodule) {
    window.location.href = submodule.url;
  }

  submodulePathClick(submodule) {
    window.location.href = document.URL + ungit.config.fileSeparator + submodule.path;
  }

  submoduleRemove(submodule) {
    components.create('yesnodialog', { title: 'Are you sure?', details: `Deleting ${submodule.name} submodule cannot be undone with ungit.`})
      .show()
      .closeThen((diag) => {
        if (!diag.result()) return;
        this.server.delPromise('/submodules', { path: this.repoPath(), submodulePath: submodule.path, submoduleName: submodule.name })
          .then(() => { programEvents.dispatch({ event: 'submodule-fetch' }); })
          .catch((e) => this.server.unhandledRejection(e));
      });
  }
}
