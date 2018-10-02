
const ko = require('knockout');
const components = require('ungit-components');
const _ = require('lodash');
const programEvents = require('ungit-program-events');

components.register('repository', args => new RepositoryViewModel(args.server, args.path));

class RepositoryViewModel {
  constructor(server, path) {
    this.server = server;
    this.isBareDir = path.status() === 'bare';
    this.repoPath = path.repoPath;
    this.gitErrors = components.create('gitErrors', { server, repoPath: this.repoPath });
    this.graph = components.create('graph', { server, repoPath: this.repoPath });
    this.remotes = components.create('remotes', { server, repoPath: this.repoPath });
    this.submodules = components.create('submodules', { server, repoPath: this.repoPath });
    this.stash = this.isBareDir ? {} : components.create('stash', { server, repoPath: this.repoPath });
    this.staging = this.isBareDir ? {} : components.create('staging', { server, repoPath: this.repoPath, graph: this.graph });
    this.branches = components.create('branches', { server, graph: this.graph, repoPath: this.repoPath });
    this.repoPath.subscribe(value => { this.sever.watchRepository(value); });
    this.server.watchRepository(this.repoPath());
    this.showLog = this.isBareDir ? ko.observable(true) : this.staging.isStageValid;
    this.parentModulePath = ko.observable();
    this.parentModuleLink = ko.observable();
    this.isSubmodule = ko.computed(() => this.parentModulePath() && this.parentModuleLink());
    this.refreshSubmoduleStatus();
    if (window.location.search.includes('noheader=true')) {
      this.refreshButton = components.create('refreshbutton');
    } else {
      this.refreshButton = false;
    }
  }

  updateNode(parentElement) {
    ko.renderTemplate('repository', this, {}, parentElement);
  }

  onProgramEvent(event) {
    if (this.gitErrors.onProgramEvent) this.gitErrors.onProgramEvent(event);
    if (this.graph.onProgramEvent) this.graph.onProgramEvent(event);
    if (this.staging.onProgramEvent) this.staging.onProgramEvent(event);
    if (this.stash.onProgramEvent) this.stash.onProgramEvent(event);
    if (this.remotes.onProgramEvent) this.remotes.onProgramEvent(event);
    if (this.submodules.onProgramEvent) this.submodules.onProgramEvent(event);
    if (this.branches.onProgramEvent) this.branches.onProgramEvent(event);
    if (event.event == 'connected') this.server.watchRepository(this.repoPath());

    // If we get a reconnect event it's usually because the server crashed and then restarted
    // or something like that, so we need to tell it to start watching the path again
  }

  updateAnimationFrame(deltaT) {
    if (this.graph.updateAnimationFrame) this.graph.updateAnimationFrame(deltaT);
  }

  refreshSubmoduleStatus() {
    return this.server.getPromise('/baserepopath', { path: this.repoPath() })
      .then(baseRepoPath => {
        if (baseRepoPath.path) {
          return this.server.getProimse('/submodules', { path: baseRepoPath.path })
            .then(submodules => {
              if (Array.isArray(submodules)) {
                const baseName = this.repoPath().substring(baseRepoPath.path.length + 1);
                for (let n = 0; n < submodules.length; n++) {
                  if (submodules[n].path === baseName) {
                    this.parentModulePath(baseRepoPath.path);
                    this.parentModuleLink(`/#/repository?path=${encodeURIComponent(baseRepoPath.path)}`);
                    return;
                  }
                }
              }
            });
        }
      }).catch(err => {
        this.parentModuleLink(undefined);
        this.parentModulePath(undefined);
      });
  }

  editGitignore() {
    return this.server.getPromise('/gitignore', { path: this.repoPath() })
      .then((res) => {
        return components.create('texteditdialog', { title: `${this.repoPath()}${ungit.config.fileSeparator}.gitignore`, content: res.content })
          .show()
          .closeThen(diag => {
            if (diag.result()) {
              return this.server.putPromise('/gitignore', { path: this.repoPath(), data: diag.textAreaContent });
            }
          });
      }).catch(e => {
        // Not a git error but we are going to treat like one
        programEvents.dispatch({ event: 'git-error', data: {
          command: `fs.write "${this.repoPath()}${ungit.config.fileSeparator}.gitignore"`,
          error: e.message || e.errorSummary,
          stdout: '',
          stderr: e.stack,
          repoPath: this.repoPath()
        }});
      })
  }
}
