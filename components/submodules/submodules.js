const ko = require('knockout');
const octicons = require('octicons');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');

components.register('submodules', (args) => new SubmodulesViewModel(args.server, args.repoPath));

class SubmodulesViewModel {
  constructor(server, repoPath) {
    ungit._isSubmoduleUpdating = false;
    this.repoPath = repoPath;
    this.server = server;
    this.submodules = ko.observableArray();
    this.submodulesIcon = octicons['file-submodule'].toSVG({ height: 18 });
    this.closeIcon = octicons.x.toSVG({ height: 18 });
    this.linkIcon = octicons['link-external'].toSVG({ height: 18 });
  }

  async onProgramEvent(event) {
    if (event.event == 'submodule-fetch') await this.fetchSubmodules();
  }

  updateNode(parentElement) {
    this.fetchSubmodules().then((submoduleViewModel) => {
      ko.renderTemplate('submodules', submoduleViewModel, {}, parentElement);
    });
  }

  async fetchSubmodules() {
    try {
      const submodules = await this.server.getPromise('/submodules', { path: this.repoPath() });
      this.submodules(submodules && Array.isArray(submodules) ? submodules : []);
      return this;
    } catch (e) {
      ungit.logger.error('error during fetchSubmodules', e);
    }
  }

  updateSubmodules() {
    if (ungit._isSubmoduleUpdating) return;
    ungit._isSubmoduleUpdating = true;
    return this.server
      .postPromise('/submodules/update', { path: this.repoPath() })
      .catch((e) => this.server.unhandledRejection(e))
      .finally(() => {
        ungit._isSubmoduleUpdating = false;
      });
  }

  showAddSubmoduleDialog() {
    components
      .create('addsubmoduledialog')
      .show()
      .closeThen((diag) => {
        if (!diag.isSubmitted()) return;
        ungit._isSubmoduleUpdating = true;
        this.server
          .postPromise('/submodules/add', {
            path: this.repoPath(),
            submoduleUrl: diag.url(),
            submodulePath: diag.path(),
          })
          .then(() => {
            programEvents.dispatch({ event: 'submodule-fetch' });
          })
          .catch((e) => this.server.unhandledRejection(e))
          .finally(() => {
            ungit._isSubmoduleUpdating = false;
          });
      });
  }

  submoduleLinkClick(submodule) {
    window.location.href = submodule.url;
  }

  submodulePathClick(submodule) {
    window.location.href = document.URL + ungit.config.fileSeparator + submodule.path;
  }

  submoduleRemove(submodule) {
    components
      .create('yesnodialog', {
        title: 'Are you sure?',
        details: `Deleting ${submodule.name} submodule cannot be undone with ungit.`,
      })
      .show()
      .closeThen((diag) => {
        if (!diag.result()) return;
        this.server
          .delPromise('/submodules', {
            path: this.repoPath(),
            submodulePath: submodule.path,
            submoduleName: submodule.name,
          })
          .then(() => {
            programEvents.dispatch({ event: 'submodule-fetch' });
          })
          .catch((e) => this.server.unhandledRejection(e));
      });
  }
}
