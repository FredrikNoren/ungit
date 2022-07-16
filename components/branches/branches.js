const ko = require('knockout');
const _ = require('lodash');
const octicons = require('octicons');
const components = require('ungit-components');
const storage = require('ungit-storage');
const showRemote = 'showRemote';
const showBranch = 'showBranch';
const showTag = 'showTag';
const { ComponentRoot } = require('../ComponentRoot');

components.register('branches', (args) => {
  return new BranchesViewModel(args.server, args.graph, args.repoPath);
});

class BranchesViewModel extends ComponentRoot {
  constructor(server, /** @type {GitGraph} */ graph, repoPath) {
    super();
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
    };
    this.shouldAutoFetch = ungit.config.autoFetch;
    this.isShowRemote.subscribe(() => {
      this.clearApiCache();
      setLocalStorageAndUpdate(showRemote);
    });
    this.isShowBranch.subscribe(() => {
      this.clearApiCache();
      setLocalStorageAndUpdate(showBranch);
    });
    this.isShowTag.subscribe(() => {
      this.clearApiCache();
      setLocalStorageAndUpdate(showTag);
    });
    this.refsLabel = ko.computed(() => this.current() || 'master (no commits yet)');
    this.branchIcon = octicons['git-branch'].toSVG({ height: 18 });
    this.closeIcon = octicons.x.toSVG({ height: 18 });
    this.firstFetch = true;
  }

  checkoutBranch(branch) {
    branch.checkout();
  }
  updateNode(parentElement) {
    ko.renderTemplate('branches', this, {}, parentElement);
  }
  clickFetch() {
    this.updateRefs(true);
  }
  onProgramEvent(event) {
    if (
      event.event === 'request-app-content-refresh' ||
      event.event === 'branch-updated' ||
      event.event === 'git-directory-changed' ||
      event.event === 'current-remote-changed'
    ) {
      this.updateRefs();
    }
  }
  updateRefs(forceRemoteFetch) {
    forceRemoteFetch = forceRemoteFetch || this.shouldAutoFetch || '';
    if (this.firstFetch) forceRemoteFetch = '';

    const currentBranchProm = this.server
      .getPromise('/checkout', { path: this.repoPath() })
      .then((branch) => this.current(branch))
      .catch((err) => this.current('~error'));

    // refreshes tags branches and remote branches
    // TODO refresh remote refs separately, notify autofetch via ws
    const refsProm = this.server
      .getPromise('/refs', { path: this.repoPath(), remoteFetch: forceRemoteFetch })
      .then((refs) => {
        const stamp = Date.now();
        const locals = [];
        for (const { name, sha1, date } of refs) {
          const lname = name.replace('refs/tags', 'tag: refs/tags');
          // side effect: registers the ref
          const ref = this.graph.getRef(lname, sha1);
          const node = ref.node();
          if (date && !node.isInited()) {
            const ts = Date.parse(date);
            // Push down uninited nodes based on date
            if (!node.date || node.date > ts) node.date = ts;
          }
          ref.stamp = stamp;
          const { localRefName, isRemote, isBranch, isTag } = ref;
          if (
            !(
              localRefName == 'refs/stash' ||
              // Remote HEAD
              localRefName.endsWith('/HEAD') ||
              (isRemote && !this.isShowRemote()) ||
              (isBranch && !this.isShowBranch()) ||
              (isTag && !this.isShowTag())
            )
          )
            locals.push(ref);
        }
        locals.sort((a, b) => {
          if (a.current() || b.current()) {
            // Current branch is always first
            return a.current() ? -1 : 1;
          } else if (a.isRemoteBranch !== b.isRemoteBranch) {
            // Remote branches show last
            return a.isRemoteBranch ? 1 : -1;
          } else {
            // Otherwise, sort by name, grouped by remoteness
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
          }
        });
        this.branchesAndLocalTags(locals);
        this.graph.refs().forEach((ref) => {
          // ref was removed from another source
          if (!ref.isRemoteTag && ref.value !== 'HEAD' && ref.stamp !== stamp) {
            ref.remove(true);
          }
        });
        this.graph.fetchCommits();
      })
      .catch((e) => this.server.unhandledRejection(e));

    if (this.firstFetch) {
      refsProm.then(() => {
        this.firstFetch = false;
        // Fetch remotes on first load
        this.updateRefs(true);
      });
    }
    return Promise.all([currentBranchProm, refsProm]);
  }

  branchRemove(branch) {
    let details = `"${branch.refName}"`;
    if (branch.isRemoteBranch) {
      details = `<code style='font-size: 100%'>REMOTE</code> ${details}`;
    }
    components.showModal('yesnomodal', {
      title: 'Are you sure?',
      details: 'Deleting ' + details + ' branch cannot be undone with ungit.',
      closeFunc: (isYes) => {
        if (!isYes) return;
        return branch.remove();
      },
    });
  }
}
