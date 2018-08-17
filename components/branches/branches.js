const ko = require('knockout');
const _ = require('lodash');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const storage = require('ungit-storage');
const showRemote = 'showRemote';
const showBranch = 'showBranch';
const showTag = 'showTag';
const Bluebird = require('bluebird');

components.register('branches', (args) => {
  return new BranchesViewModel(args.server, args.graph, args.repoPath);
});

class BranchesViewModel {
  constructor(server, graph, repoPath) {
    this.repoPath = repoPath;
    this.server = server;
    this.branchesAndLocalTags = ko.observableArray();
    this.current = ko.observable();
    this.isShowRemote = ko.observable(storage.getItem(showRemote) != 'false');
    this.isShowBranch = ko.observable(storage.getItem(showBranch) != 'false');
    this.isShowTag = ko.observable(storage.getItem(showTag) != 'false');
    this.graph = graph;
    const setLocalStorageAndUpdate = (localStorageKey, value) => {
      storage.setItem(localStorageKey, value);
      this.updateRefs();
      return value;
    }
    this.isShowRemote.subscribe(setLocalStorageAndUpdate.bind(null, showRemote));
    this.isShowBranch.subscribe(setLocalStorageAndUpdate.bind(null, showBranch));
    this.isShowTag.subscribe(setLocalStorageAndUpdate.bind(null, showTag));
    this.fetchLabel = ko.computed(() => {
      if (this.current()) {
        return this.current();
      }
    });
    this.updateRefsDebounced = _.debounce(this.updateRefs, 500);
  }

  checkoutBranch(branch) { branch.checkout(); }
  updateNode(parentElement) { ko.renderTemplate('branches', this, {}, parentElement); }
  clickFetch() { this.updateRefs(); }
  onProgramEvent(event) {
    if (event.event === 'working-tree-changed' || event.event === 'request-app-content-refresh' ||
      event.event === 'branch-updated' || event.event === 'git-directory-changed') {
      this.updateRefsDebounced();
    }
  }
  updateRefs() {
    const currentBranchProm = this.server.getPromise('/branches', { path: this.repoPath() })
      .then((branches) => branches.forEach((b) => { if (b.current) { this.current(b.name); } }))
      .catch((err) => { this.current("~error"); })

    // refreshes tags branches and remote branches
    const refsProm = this.server.getPromise('/refs', { path: this.repoPath() })
      .then((refs) => {
        const version = Date.now();
        const sorted = refs.map((r) => {
          const ref = this.graph.getRef(r.name.replace('refs/tags', 'tag: refs/tags'));
          ref.node(this.graph.getNode(r.sha1));
          ref.version = version;
          return ref;
        }).sort((a, b) => {
          if (a.current() || b.current()) {
            return a.current() ? -1 : 1;
          } else if (a.isRemoteBranch === b.isRemoteBranch) {
            if (a.name < b.name) {
               return -1;
            } if (a.name > b.name) {
              return 1;
            }
            return 0;
          } else {
            return a.isRemoteBranch ? 1 : -1;
          }
        }).filter((ref) => {
          if (ref.localRefName == 'refs/stash')     return false;
          if (ref.localRefName.endsWith('/HEAD'))   return false;
          if (!this.isShowRemote() && ref.isRemote) return false;
          if (!this.isShowBranch() && ref.isBranch) return false;
          if (!this.isShowTag() && ref.isTag)       return false;
          return true;
        });
        this.branchesAndLocalTags(sorted);
        this.graph.refs().forEach((ref) => {
          // ref was removed from another source
          if (!ref.isRemoteTag && ref.value !== 'HEAD' && (!ref.version || ref.version < version)) {
            ref.remove(true);
          }
        });
      }).catch((e) => this.server.unhandledRejection(e));

    return Promise.all([currentBranchProm, refsProm])
  }

  branchRemove(branch) {
    let details = `"${branch.refName}"`;
    if (branch.isRemoteBranch) {
      details = `<code style='font-size: 100%'>REMOTE</code> ${details}`;
    }
    components.create('yesnodialog', { title: 'Are you sure?', details: 'Deleting ' + details + ' branch cannot be undone with ungit.'})
      .show()
      .closeThen((diag) => {
        if (!diag.result()) return;
        const url = `${branch.isRemote ? '/remote' : ''}/branches`;
        return this.server.delPromise(url, { path: this.graph.repoPath(), remote: branch.isRemote ? branch.remote : null, name: branch.refName })
          .then(() => { programEvents.dispatch({ event: 'working-tree-changed' }) })
          .catch((e) => this.server.unhandledRejection(e));
      });
  }
}
