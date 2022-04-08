import * as $ from 'jquery';
import * as ko from 'knockout';
import { AbstractGraph } from './abstract-graph';
import { AbstractNode } from './abstract-node';

declare const ungit: any;
const components = ungit.components;
const programEvents = ungit.programEvents;
const md5 = require('blueimp-md5');
const octicons = require('octicons');

import {
  ActionBase,
  Move,
  Rebase,
  Push,
  Merge,
  Reset,
  Checkout,
  Delete,
  CherryPick,
  Uncommit,
  Revert,
  Squash
} from './git-graph-actions';
import { Selectable } from './selectable';
const maxBranchesToDisplay = Math.floor((ungit.config.numRefsToShow / 5) * 3); // 3/5 of refs to show to branches
const maxTagsToDisplay = ungit.config.numRefsToShow - maxBranchesToDisplay; // 2/5 of refs to show to tags

export class NodeViewModel extends AbstractNode {
  ancestorOfHEADTimeStamp: undefined | number = undefined;
  isInited = false;
  nodeIsMousehover = ko.observable(false);

  // git variables
  sha1: string;
  title = ko.observable<string>();
  parents = ko.observableArray<string>();
  commitTime: undefined | string = undefined; // commit time in string
  signatureDate = ko.observable<string>();
  signatureMade = ko.observable<string>();
  pgpVerifiedString = ko.pureComputed(() => {
    if (this.signatureMade()) {
      return `PGP by: ${this.signatureMade()} at ${this.signatureDate()}`;
    }
  });

  // refs
  ideologicalBranch: RefViewModel | undefined = undefined;
  branches = ko.pureComputed(() => this.refs().filter(ref => ref.isBranch));
  tags = ko.pureComputed(() => this.refs().filter(ref => ref.isTag));
  refsToDisplayOverride = ko.observable<RefViewModel | undefined>(undefined);
  refsToDisplay = ko.pureComputed(() => {
    const numberOfBranches = ungit.config.numRefsToShow - Math.min(this.tags().length, maxTagsToDisplay);
    const branchesToDisplay = this.branches().slice(0, numberOfBranches);
    const numberOfTags = ungit.config.numRefsToShow - branchesToDisplay.length;
    const tagsToDisplay = this.tags().slice(0, numberOfTags);
    const refsToDisplay = branchesToDisplay.concat(tagsToDisplay);

    if (this.refsToDisplayOverride()) {
      refsToDisplay[refsToDisplay.length - 1] = this.refsToDisplayOverride();
    }

    return refsToDisplay
  });

  // graph variables
  color = ko.observable<string>();
  commitContainerVisible: ko.Computed<boolean>
  isNodeAccented = ko.pureComputed(() => this.selected() || this.isEdgeHighlighted());
  showNewRefAction: ko.Computed<boolean>
  showRefSearch = ko.pureComputed(
    () => this.branches().length + this.tags().length > ungit.config.numRefsToShow
  );
  newBranchName = ko.observable<string>();
  newBranchNameHasFocus = ko.observable(true);
  branchingFormVisible = ko.observable(false);
  canCreateRef = ko.pureComputed(
    () =>
      this.newBranchName() && this.newBranchName().trim() && !this.newBranchName().includes(' ')
  );
  branchOrder = ko.observable<number>();
  refSearchFormVisible = ko.observable(false);
  getGraphAttr: ko.Computed<number[]>
  dropareaGraphActions: ko.Computed<ActionBase[]>

  constructor(graph: AbstractGraph, sha1: string) {
    super(graph);
    this.sha1 = sha1;
    this.selected.subscribe(() => {
      ungit.programEvents.dispatch({ event: 'graph-render' });
    });
    this.dropareaGraphActions = ko.pureComputed(() => {
      if (this.isViewable()) {
        return [
          new Move(this.graph, this),
          new Rebase(this.graph, this),
          new Merge(this.graph, this),
          new Push(this.graph, this),
          new Reset(this.graph, this),
          new Checkout(this.graph, this),
          new Delete(this.graph, this),
          new CherryPick(this.graph, this),
          new Uncommit(this.graph, this),
          new Revert(this.graph, this),
          new Squash(this.graph, this),
        ];
      } else {
        return []
      }
    }).extend({ rateLimit: { timeout: 250, method: "notifyWhenChangesStop" } });

    this.commitComponent = components.create('commit', this);
    this.r = ko.observable<number>();
    this.cx = ko.observable<number>();
    this.cy = ko.observable<number>();
    this.commitContainerVisible = ko.pureComputed(
      () => {
        return this.ancestorOfHEAD() || this.nodeIsMousehover() || this.selected();
      }
    );
    this.showNewRefAction = ko.pureComputed(() => {
      return !this.graph.currentActionContext();
    });
    this.getGraphAttr = ko.pureComputed(() => [this.cx(), this.cy()]);
  }


  setGraphAttr(val) {
    this.element().setAttribute('x', (val[0] - 30).toString());
    this.element().setAttribute('y', (val[1] - 30).toString());
  }

  render() {
    this.refSearchFormVisible(false);
    if (!this.isInited) return;
    if (this.ancestorOfHEAD()) {
      this.r(30);
      this.cx(610);

      if (!this.aboveNode) {
        this.cy(120);
      } else if (this.aboveNode.ancestorOfHEAD()) {
        this.cy(this.aboveNode.cy() + 120);
      } else {
        this.cy(this.aboveNode.cy() + 60);
      }
    } else {
      this.r(15);
      this.cx(610 + 90 * this.branchOrder());
      this.cy(this.aboveNode ? this.aboveNode.cy() + 60 : 120);
    }

    this.color(this.ideologicalBranch ? this.ideologicalBranch.color : '#666');
    this.animate();
  }

  setData(logEntry) {
    this.title(logEntry.message.split('\n')[0]);
    this.parents(logEntry.parents || []);
    this.commitTime = logEntry.commitDate;
    this.date = Date.parse(this.commitTime);
    this.commitComponent.setData(logEntry);
    this.signatureMade(logEntry.signatureMade);
    this.signatureDate(logEntry.signatureDate);

    (logEntry.refs || []).forEach((ref) => {
      this.graph.getRef(ref, undefined).node(this);
    });
    this.isInited = true;
  }

  showBranchingForm() {
    this.branchingFormVisible(true);
    this.newBranchNameHasFocus(true);
  }

  showRefSearchForm(obj, event) {
    this.refSearchFormVisible(true);

    const textBox = event.currentTarget.parentElement.querySelector('input[type="search"]');
    const $textBox = <any>$(textBox);

    if (!$textBox.autocomplete('instance')) {
      const renderItem = (ul, item) => $(`<li><a>${item.displayHtml()}</a></li>`).appendTo(ul);
      $textBox.autocomplete({
        classes: {
          'ui-autocomplete': 'dropdown-menu',
        },
        source: this.refs().filter((ref) => !ref.isHEAD),
        minLength: 0,
        create: (event) => {
          $(event.target).data('ui-autocomplete')._renderItem = renderItem;
        },
        select: (_event, ui) => {
          const ref = ui.item;
          if (!this.refsToDisplay().includes(ref)) {
            this.refsToDisplayOverride(ref);
          }
          // Clear search input on selection
          return false;
        },
      });
      $textBox.on('focus', (event) => {
        (<any>$(event.target)).autocomplete('search', event.target.value);
      });
      $textBox.autocomplete('search', '');
    }
  }

  createBranch() {
    if (!this.canCreateRef()) return;
    this.graph.server
      .postPromise('/branches', {
        path: this.graph.repoPath(),
        name: this.newBranchName(),
        sha1: this.sha1,
      })
      .then(() => {
        this.graph.getRef(`refs/heads/${this.newBranchName()}`, undefined).node(this);
        if (ungit.config.autoCheckoutOnBranchCreate) {
          return this.graph.server.postPromise('/checkout', {
            path: this.graph.repoPath(),
            name: this.newBranchName(),
          });
        }
      })
      .catch((e) => this.graph.server.unhandledRejection(e))
      .finally(() => {
        this.branchingFormVisible(false);
        this.newBranchName('');
        ungit.programEvents.dispatch({ event: 'branch-updated' });
      });
  }

  createTag() {
    if (!this.canCreateRef()) return;
    this.graph.server
      .postPromise('/tags', {
        path: this.graph.repoPath(),
        name: this.newBranchName(),
        sha1: this.sha1,
      })
      .then(() => this.graph.getRef(`refs/tags/${this.newBranchName()}`, undefined).node(this))
      .catch((e) => this.graph.server.unhandledRejection(e))
      .finally(() => {
        this.branchingFormVisible(false);
        this.newBranchName('');
      });
  }

  toggleSelected() {
    const beforeThisCR = this.commitComponent.element().getBoundingClientRect();
    const belowY = this.belowNode ? this.belowNode.cy() : undefined;

    let prevSelected = this.graph.currentActionContext();
    if (!(prevSelected instanceof NodeViewModel)) prevSelected = null;
    const prevSelectedCR = prevSelected
      ? prevSelected.commitComponent.element().getBoundingClientRect()
      : null;
    this.selected(!this.selected());

    // If we are deselecting
    if (!this.selected()) {
      if (beforeThisCR.top < 0 && belowY && this.belowNode.commitComponent.element()) {
        const afterBelowCR = this.belowNode.commitComponent.element().getBoundingClientRect();
        // If the next node is showing, try to keep it in the screen (no jumping)
        if (belowY < window.innerHeight) {
          window.scrollBy(0, afterBelowCR.top - belowY);
          // Otherwise just try to bring them to the middle of the screen
        } else {
          window.scrollBy(0, afterBelowCR.top - window.innerHeight / 2);
        }
      }
      // If we are selecting
    } else {
      const afterThisCR = this.commitComponent.element().getBoundingClientRect();
      if (
        prevSelectedCR &&
        (prevSelectedCR.top < 0 || prevSelectedCR.top > window.innerHeight) &&
        afterThisCR.top != beforeThisCR.top
      ) {
        window.scrollBy(0, -(beforeThisCR.top - afterThisCR.top));
        console.log('Fix');
      }
    }
    return false;
  }

  removeRef(ref: RefViewModel) {
    this.refs.remove(ref);
  }

  pushRef(ref: RefViewModel) {
    this.refs.push(ref);
  }

  getRightToLeftStrike() {
    return `M ${this.cx() - 30} ${this.cy() - 30} L ${this.cx() + 30} ${this.cy() + 30}`;
  }

  getLeftToRightStrike() {
    return `M ${this.cx() + 30} ${this.cy() - 30} L ${this.cx() - 30} ${this.cy() + 30}`;
  }

  nodeMouseover() {
    this.nodeIsMousehover(true);
  }

  nodeMouseout() {
    this.nodeIsMousehover(false);
  }
}


export class RefViewModel extends Selectable {
  server: any

  // used at nodes-edges
  lastSlottedTimeStamp: number;
  branchOrder: number;

  version: number
  name: string
  // node is `NodeViewModel`. Keeping in any to avoid circular dependencies
  node: ko.Observable<NodeViewModel> = ko.observable()
  localRefName: string // origin/master or master
  refName: string // master
  remote: string
  color: string
  value: string

  // flags
  isRemoteTag: boolean
  isLocalTag: boolean
  isTag: boolean
  isLocalHEAD: boolean
  isRemoteHEAD: boolean
  isLocalBranch: boolean
  isRemoteBranch: boolean
  isStash: boolean
  isHEAD: boolean
  isBranch: boolean
  isRemote: boolean
  isLocal: boolean
  show: boolean

  // observables
  isDragging: ko.Observable<boolean>
  current: ko.Computed<boolean>

  constructor(fullRefName: string, graph: AbstractGraph) {
    super(graph);
    this.graph = graph;
    this.name = fullRefName;
    this.localRefName = this.name;
    this.isRemoteTag = this.name.indexOf('remote-tag: ') === 0;
    this.isLocalTag = this.name.indexOf('tag: ') === 0;
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
    const splitedName = (this.localRefName || this.name).split('/');
    if (this.isRemote) {
      // get rid of the origin/ part of origin/branchname
      this.remote = splitedName[0];
      this.refName = splitedName.slice(1).join('/');
    }
    this.show = true;
    this.server = this.graph.server;
    this.isDragging = ko.observable(false);
    this.current = ko.pureComputed(
      () => this.isLocalBranch && this.graph.checkedOutBranch() == this.refName
    );
    this.color = this._colorFromHashOfString(this.name);

    this.node.subscribe(
      (oldNode) => {
        if (oldNode) oldNode.removeRef(this);
      },
      null,
      'beforeChange'
    );
    this.node.subscribe((newNode) => {
      if (newNode) newNode.pushRef(this);
    });

    // This optimization is for autocomplete display
    this.value = splitedName[splitedName.length - 1];
  }

  displayHtml(largeCurrent) {
    const size = largeCurrent && this.current() ? 26 : 18;
    let prefix = '';
    if (this.isRemote) {
      prefix = `<span>${octicons.globe.toSVG({ height: size })}</span> `;
    }
    if (this.isBranch) {
      prefix += `<span>${octicons['git-branch'].toSVG({ height: size })}</span> `;
    } else if (this.isTag) {
      prefix += `<span>${octicons.tag.toSVG({ height: size })}</span> `;
    }
    return prefix + this.localRefName;
  }

  _colorFromHashOfString(string) {
    return `#${md5(string).toString().slice(0, 6)}`;
  }

  dragStart() {
    this.graph.currentActionContext(this);
    this.isDragging(true);
    if (document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }
  }

  dragEnd() {
    this.graph.currentActionContext(null);
    this.isDragging(false);
  }

  moveTo(target, rewindWarnOverride) {
    let promise;
    if (this.isLocal) {
      const toNode = this.graph.nodesEdges.nodesById[target];
      const args = {
        path: this.graph.repoPath(),
        name: this.refName,
        sha1: target,
        force: true,
        to: target,
        mode: 'hard',
      };
      let operation;
      if (this.current()) {
        operation = '/reset';
      } else if (this.isTag) {
        operation = '/tags';
      } else {
        operation = '/branches';
      }

      if (!rewindWarnOverride && this.node().date > toNode.date) {
        promise = new Promise((resolve, reject) => {
          components.showModal('yesnomodal', {
            title: 'Are you sure?',
            details: 'This operation potentially going back in history.',
            closeFunc: (isYes) => {
              if (isYes) {
                return this.server.postPromise(operation, args).then(resolve).catch(reject);
              }
            },
          });
        });
      } else {
        promise = this.server.postPromise(operation, args);
      }
    } else {
      const pushReq = {
        path: this.graph.repoPath(),
        remote: this.remote,
        refSpec: target,
        remoteBranch: this.refName,
        force: false
      };
      promise = this.server.postPromise('/push', pushReq).catch((err) => {
        if (err.errorCode === 'non-fast-forward') {
          return new Promise((resolve, reject) => {
            components.showModal('yesnomodal', {
              title: 'Force push?',
              details: "The remote branch can't be fast-forwarded.",
              closeFunc: (isYes) => {
                if (!isYes) return resolve(false);
                pushReq.force = true;
                this.server.postPromise('/push', pushReq).then(resolve).catch(reject);
              },
            });
          });
        } else {
          this.server.unhandledRejection(err);
        }
      });
    }

    return promise
      .then((res) => {
        if (!res) return;
        const targetNode = this.graph.nodesEdges.getNode(target);
        if (this.graph.checkedOutBranch() == this.refName) {
          this.graph.HEADref().node(targetNode);
        }
        this.node(targetNode);
      })
      .catch((e) => this.server.unhandledRejection(e));
  }

  remove(isClientOnly) {
    let url = this.isTag ? '/tags' : '/branches';
    if (this.isRemote) url = `/remote${url}`;

    return (
      isClientOnly
        ? Promise.resolve()
        : this.server.delPromise(url, {
          path: this.graph.repoPath(),
          remote: this.isRemote ? this.remote : null,
          name: this.refName,
        })
    )
      .then(() => {
        if (this.node()) {
          this.node().removeRef(this);
        }
        delete this.graph.refsByRefName[this.name];
      })
      .catch((e) => this.server.unhandledRejection(e))
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
    return this.server
      .postPromise('/push', {
        path: this.graph.repoPath(),
        remote: this.graph.currentRemote(),
        refSpec: this.refName,
        remoteBranch: this.refName,
      })
      .catch((e) => this.server.unhandledRejection(e));
  }

  checkout() {
    const isRemote = this.isRemoteBranch;
    const isLocalCurrent = this.getLocalRef() && this.getLocalRef().current();

    return Promise.resolve()
      .then(() => {
        if (isRemote && !isLocalCurrent) {
          return this.server.postPromise('/branches', {
            path: this.graph.repoPath(),
            name: this.refName,
            sha1: this.name,
            force: true,
          });
        }
      })
      .then(() =>
        this.server.postPromise('/checkout', { path: this.graph.repoPath(), name: this.refName })
      )
      .then(() => {
        if (isRemote && isLocalCurrent) {
          return this.server.postPromise('/reset', {
            path: this.graph.repoPath(),
            to: this.name,
            mode: 'hard',
          });
        }
      })
      .then(() => {
        this.graph.HEADref().node(this.node());
      })
      .catch((err) => {
        if (err.errorCode != 'merge-failed') {
          this.server.unhandledRejection(err);
        } else {
          ungit.logger.warn('checkout failed', err);
        }
      });
  }
}
