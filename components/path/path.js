const ko = require('knockout');
const components = require('ungit-components');
const addressParser = require('ungit-address-parser');
const navigation = require('ungit-navigation');
const programEvents = require('ungit-program-events');
const { encodePath } = require('ungit-address-parser');
const octicons = require('octicons');
const storage = require('ungit-storage');

const showCreateRepoKey = 'isShowCreateRepo';

components.register('path', (args) => {
  return new PathViewModel(args.server, args.path);
});

class SubRepositoryViewModel {
  constructor(server, path) {
    this.path = path;
    this.title = path;
    this.link = `${ungit.config.rootPath}/#/repository?path=${encodePath(path)}`;
    this.arrowIcon = octicons['arrow-right'].toSVG({ height: 24 });
    this.remote = ko.observable('...');

    server
      .getPromise(`/remotes/origin?path=${encodePath(this.path)}`)
      .then((remote) => {
        this.remote(remote.address.replace(/\/\/.*?@/, '//***@'));
      })
      .catch((err) => {
        this.remote('');
      });
  }
}

class PathViewModel {
  constructor(server, path) {
    this.server = server;
    this.repoPath = ko.observable(path);
    this.dirName =
      this.repoPath()
        .replace(/\\/g, '/')
        .split('/')
        .filter((s) => s)
        .slice(-1)[0] || '/';
    this.status = ko.observable('loading');
    this.cloneUrl = ko.observable();
    this.showDirectoryCreatedAlert = ko.observable(false);
    this.subRepos = ko.observableArray();
    this.cloneDestinationImplicit = ko.computed(() => {
      const defaultText = 'destination folder';
      if (!this.cloneUrl()) return defaultText;

      const parsedAddress = addressParser.parseAddress(this.cloneUrl());
      return parsedAddress.shortProject || defaultText;
    });
    this.cloneDestination = ko.observable();
    this.repository = ko.observable();
    this.expandIcon = ko.observable();
    this.isRecursiveSubmodule = ko.observable(true);
    this.showCreateRepoKey = `${showCreateRepoKey}-${this.repoPath()}`;
    const storageValue = storage.getItem(this.showCreateRepoKey);
    this.isShowCreateRepo = ko.observable(storageValue && storageValue === 'false' ? false : true);
    this.updateShowCreateRepoMetadata();
  }

  toggleShowCreateRepo() {
    this.isShowCreateRepo(!this.isShowCreateRepo());
    storage.setItem(this.showCreateRepoKey, this.isShowCreateRepo() ? 'true' : 'false');
    this.updateShowCreateRepoMetadata();
  }

  updateShowCreateRepoMetadata() {
    if (this.isShowCreateRepo()) {
      this.expandIcon(octicons['chevron-right'].toSVG({ height: 28 }));
    } else {
      this.expandIcon(octicons['chevron-down'].toSVG({ height: 35 }));
    }
  }

  updateNode(parentElement) {
    ko.renderTemplate('path', this, {}, parentElement);
  }
  shown() {
    this.updateStatus();
  }
  updateAnimationFrame(deltaT) {
    if (this.repository()) this.repository().updateAnimationFrame(deltaT);
  }
  updateStatus() {
    return this.server
      .getPromise('/quickstatus', { path: this.repoPath() })
      .then((status) => {
        if (status.type == 'inited' || status.type == 'bare') {
          if (this.repoPath() !== status.gitRootPath) {
            this.repoPath(status.gitRootPath);
            programEvents.dispatch({ event: 'navigated-to-path', path: this.repoPath() });
            programEvents.dispatch({ event: 'working-tree-changed' });
          }
          this.status(status.type);
          if (!this.repository()) {
            this.repository(components.create('repository', { server: this.server, path: this }));
          }
        } else if (status.type == 'uninited' || status.type == 'no-such-path') {
          if (status.subRepos && status.subRepos.length > 0) {
            this.subRepos(
              status.subRepos.map((subRepo) => new SubRepositoryViewModel(this.server, subRepo))
            );
          }
          this.status(status.type);
          this.repository(null);
        }
        return null;
      })
      .catch((err) => {});
  }
  initRepository() {
    return this.server
      .postPromise('/init', { path: this.repoPath() })
      .catch((e) => this.server.unhandledRejection(e))
      .finally((res) => {
        this.updateStatus();
      });
  }
  onProgramEvent(event) {
    if (event.event == 'working-tree-changed') this.updateStatus();
    else if (event.event == 'request-app-content-refresh') this.updateStatus();

    if (this.repository()) this.repository().onProgramEvent(event);
  }
  cloneRepository() {
    this.status('cloning');
    const dest = this.cloneDestination() || this.cloneDestinationImplicit();

    return this.server
      .postPromise('/clone', {
        path: this.repoPath(),
        url: this.cloneUrl(),
        destinationDir: dest,
        isRecursiveSubmodule: this.isRecursiveSubmodule(),
      })
      .then((res) => navigation.browseTo('repository?path=' + addressParser.encodePath(res.path)))
      .catch((e) => this.server.unhandledRejection(e))
      .finally(() => {
        programEvents.dispatch({ event: 'working-tree-changed' });
      });
  }
  createDir() {
    this.showDirectoryCreatedAlert(true);
    return this.server
      .postPromise('/createDir', { dir: this.repoPath() })
      .catch((e) => this.server.unhandledRejection(e))
      .then(() => this.updateStatus());
  }
}
