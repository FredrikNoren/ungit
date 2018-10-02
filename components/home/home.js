
const ko = require('knockout');
const components = require('ungit-components');

components.register('home', args => new HomeViewModel(args.app));

class HomeRepositoryViewModel {
  constructor(home, path) {
    this.home = home;
    this.app = home.app;
    this.server = this.app.server;
    this.path = path;
    this.title = path;
    this.link = `${ungit.config.rootPath}/#/repository?path=${encodeURIComponent(path)}`;
    this.pathRemoved = ko.observable(false);
    this.remote = ko.observable('...');
    this.updateState();
  }

  updateState() {
    this.server.getPromise(`/fs/exists?path=${encodeURIComponent(this.path)}`)
      .then(exists => { this.pathRemoved(!exists); })
      .catch((e) => this.server.unhandledRejection(e));
    this.server.getPromise(`/remotes/origin?path=${encodeURIComponent(this.path)}`)
      .then(remote => {	this.remote(remote.address.replace(/\/\/.*?\@/, "//***@")); })
      .catch(err => { this.remote(''); });
  }

  remove() {
    this.app.repoList.remove(this.path);
    this.home.update();
  }
}

class HomeViewModel {
  constructor(app) {
    this.app = app;
    this.repos = ko.observableArray();
    this.showNux = ko.computed(() => this.repos().length == 0);
  }

  updateNode(parentElement) {
    ko.renderTemplate('home', this, {}, parentElement);
  }

  shown() {
    this.update();
  }

  update() {
    const reposByPath = {};
    this.repos().forEach(repo => { reposByPath[repo.path] = repo; });
    this.repos(this.app.repoList().sort().map(path => {
      if (!reposByPath[path])
        reposByPath[path] = new HomeRepositoryViewModel(this, path);
      return reposByPath[path];
    }));
  }
  get template() { return 'home'; }
}
