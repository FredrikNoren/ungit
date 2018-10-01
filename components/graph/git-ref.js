const ko = require('knockout');
const md5 = require('blueimp-md5');
const Selectable = require('./selectable');
const programEvents = require('ungit-program-events');
const components = require('ungit-components');
const promise = require('bluebird');

class RefViewModel extends Selectable {
  constructor(fullRefName, graph) {
    super(graph);
    this.graph = graph;
    this.name = fullRefName;
    this.node = ko.observable();
    this.localRefName = this.name; // origin/master or master
    this.refName = this.name; // master
    this.isRemoteTag = this.name.indexOf('remote-tag: ') == 0;
    this.isLocalTag = this.name.indexOf('tag: ') == 0;
    this.isTag = this.isLocalTag || this.isRemoteTag;
    const isRemoteBranchOrHEAD = this.name.indexOf('refs/remotes/') == 0;
    this.isLocalHEAD = this.name == 'HEAD';
    this.isRemoteHEAD = this.name.includes('/HEAD');
    this.isLocalBranch = this.name.indexOf('refs/heads/') == 0;
    this.isRemoteBranch = isRemoteBranchOrHEAD && !this.isRemoteHEAD;
    this.isStash = this.name.indexOf('refs/stash') == 0;
    this.isHEAD = this.isLocalHEAD || this.isRemoteHEAD;
    this.isBranch = this.isLocalBranch || this.isRemoteBranch;
    this.isRemote = isRemoteBranchOrHEAD || this.isRemoteTag;
    this.isLocal = this.isLocalBranch || this.isLocalTag;
    if (this.isLocalBranch) {
      this.localRefName = this.name.slice('refs/heads/'.length);
      this.refName = this.localRefName;
    }
    if (this.isRemoteBranch) {
      this.localRefName = this.name.slice('refs/remotes/'.length);
    }
    if (this.isLocalTag) {
      this.localRefName = this.name.slice('tag: refs/tags/'.length);
      this.refName = this.localRefName;
    }
    if (this.isRemoteTag) {
      this.localRefName = this.name.slice('remote-tag: '.length);
    }
    const splitedName = this.localRefName.split('/')
    if (this.isRemote) {
      // get rid of the origin/ part of origin/branchname
      this.remote = splitedName[0];
      this.refName = splitedName.slice(1).join('/');
    }
    this.show = true;
    this.server = this.graph.server;
    this.isDragging = ko.observable(false);
    this.current = ko.computed(() => this.isLocalBranch && this.graph.checkedOutBranch() == this.refName);
    this.color = this._colorFromHashOfString(this.name);

    this.node.subscribe(oldNode => {
      if (oldNode) oldNode.removeRef(this);
    }, null, "beforeChange");
    this.node.subscribe(newNode => {
      if (newNode) newNode.pushRef(this);
    });

    // This optimization is for autocomplete display
    this.value = splitedName[splitedName.length - 1]
    this.label = this.localRefName
    this.dom = `${this.localRefName}<span class='octicon ${this.isTag ? 'octicon-tag' : 'octicon-git-branch'}'></span>`
    this.displayName = ko.computed(() => {
      let prefix = '';
      if (this.isRemote) {
        prefix = '<span class="octicon octicon-broadcast"></span> ';
      }
      if (this.isBranch) {
        prefix += '<span class="octicon octicon-git-branch"></span> ';
      } else if (this.current()) {
        prefix += '<span class="octicon octicon-chevron-right"></span> ';
      } else if (this.isTag) {
        prefix += '<span class="octicon octicon-tag"></span> ';
      }
      return prefix + this.localRefName;
    });
  }

  _colorFromHashOfString(string) {
    return `#${md5(string).toString().slice(0, 6)}`;
  }

  dragStart() {
    this.graph.currentActionContext(this);
    this.isDragging(true);
    if (document.activeElement) document.activeElement.blur();
  }

  dragEnd() {
    this.graph.currentActionContext(null);
    this.isDragging(false);
  }

  moveTo(target, rewindWarnOverride) {
    let promise;
    if (this.isLocal) {
      const toNode = this.graph.nodesById[target];
      const args = { path: this.graph.repoPath(), name: this.refName, sha1: target, force: true, to: target, mode: 'hard' };
      let operation;
      if (this.current()) {
        operation = '/reset';
      } else if (this.isTag) {
        operation = '/tags';
      } else {
        operation = '/branches';
      }

      if (!rewindWarnOverride && this.node().date > toNode.date) {
        promise = components.create('yesnodialog', { title: 'Are you sure?', details: 'This operation potentially going back in history.'})
          .show()
          .closeThen(diag => {
            if (diag.result()) {
              return this.server.postPromise(operation, args);
            }
          }).closePromise;
      } else {
        promise = this.server.postPromise(operation, args);
      }
    } else {
      const pushReq = { path: this.graph.repoPath(), remote: this.remote, refSpec: target, remoteBranch: this.refName };
      promise = this.server.postPromise('/push', pushReq)
        .catch(err => {
          if (err.errorCode === 'non-fast-forward') {
            return components.create('yesnodialog', { title: 'Force push?', details: 'The remote branch can\'t be fast-forwarded.' })
              .show()
              .closeThen(diag => {
                if (!diag.result()) return false;
                pushReq.force = true;
                return this.server.postPromise('/push', pushReq);
              }).closePromise;
          } else {
            this.server.unhandledRejection(err);
          }
        });
    }

    return promise
      .then(res => {
        if (!res) return;
        const targetNode = this.graph.getNode(target);
        if (this.graph.checkedOutBranch() == this.refName) {
          this.graph.HEADref().node(targetNode);
        }
        this.node(targetNode);
      }).catch((e) => this.server.unhandledRejection(e));
  }

  remove(isClientOnly) {
    let url = this.isTag ? '/tags' : '/branches';
    if (this.isRemote) url = `/remote${url}`;

    return (isClientOnly ? promise.resolve() : this.server.delPromise(url, { path: this.graph.repoPath(), remote: this.isRemote ? this.remote : null, name: this.refName }))
      .then(() => {
        if (this.node()) this.node().removeRef(this);
        this.graph.refs.remove(this);
        delete this.graph.refsByRefName[this.name];
      }).catch((e) => this.server.unhandledRejection(e))
      .finally(() => {
        if (!isClientOnly) {
          if (url == '/remote/tags') {
            programEvents.dispatch({ event: 'request-fetch-tags' });
          } else {
            programEvents.dispatch({ event: 'branch-updated' });
          }
        }
      });
  }

  getLocalRef() {
    return this.graph.getRef(this.getLocalRefFullName(), false);
  }

  getLocalRefFullName() {
    if (this.isRemoteBranch) return `refs/heads/${this.refName}`;
    if (this.isRemoteTag) return `tag: ${this.refName}`;
    return null;
  }

  getRemoteRef(remote) {
    return this.graph.getRef(this.getRemoteRefFullName(remote), false);
  }

  getRemoteRefFullName(remote) {
    if (this.isLocalBranch) return `refs/remotes/${remote}/${this.refName}`;
    if (this.isLocalTag) return `remote-tag: ${remote}/${this.refName}`;
    return null;
  }

  canBePushed(remote) {
    if (!this.isLocal) return false;
    if (!remote) return false;
    const remoteRef = this.getRemoteRef(remote);
    if (!remoteRef) return true;
    return this.node() != remoteRef.node();
  }

  createRemoteRef() {
    return this.server.postPromise('/push', { path: this.graph.repoPath(), remote: this.graph.currentRemote(), refSpec: this.refName, remoteBranch: this.refName })
      .catch((e) => this.server.unhandledRejection(e));
  }

  checkout() {
    const isRemote = this.isRemoteBranch;
    const isLocalCurrent = this.getLocalRef() && this.getLocalRef().current();

    return promise.resolve().then(() => {
        if (isRemote && !isLocalCurrent) {
          return this.server.postPromise('/branches', {
            path: this.graph.repoPath(),
            name: this.refName,
            sha1: this.name,
            force: true
          });
        }
      }).then(() => this.server.postPromise('/checkout', { path: this.graph.repoPath(), name: this.refName }))
      .then(() => {
        if (isRemote && isLocalCurrent) {
          return this.server.postPromise('/reset', { path: this.graph.repoPath(), to: this.name, mode: 'hard' });
        }
      }).then(() => {
        this.graph.HEADref().node(this.node());
      }).catch((err) => {
        if (err.errorCode != 'merge-failed') this.server.unhandledRejection(err);
      });
  }
}

module.exports = RefViewModel;
