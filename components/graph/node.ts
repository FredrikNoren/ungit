import * as ko from 'knockout';
import { Animateable } from './animateable';
import { ActionBase } from './action-base';
import { AbstractRef } from './abstract-ref';
import { AbstractNodesEdges } from './abstract-nodes-edges';

declare const ungit: any;
const components = ungit.components;

import {
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
const maxBranchesToDisplay = Math.floor((ungit.config.numRefsToShow / 5) * 3); // 3/5 of refs to show to branches
const maxTagsToDisplay = ungit.config.numRefsToShow - maxBranchesToDisplay; // 2/5 of refs to show to tags

export class NodeViewModel extends Animateable {
  nodesEdges: AbstractNodesEdges
  ancestorOfHEADTimeStamp: undefined | number = undefined;
  version = undefined;
  isInited = false;
  nodeIsMousehover = ko.observable(false);

  // git variables
  sha1: string;
  title = ko.observable<string>();
  parents = ko.observableArray<string>();
  commitTime: undefined | string = undefined; // commit time in string
  date: undefined | number = undefined; // commit time in numeric format for sort
  signatureDate = ko.observable<string>();
  signatureMade = ko.observable<string>();
  pgpVerifiedString = ko.computed(() => {
    if (this.signatureMade()) {
      return `PGP by: ${this.signatureMade()} at ${this.signatureDate()}`;
    }
  });

  // branches
  ideologicalBranch = ko.observable<AbstractRef>(); // git-ref
  remoteTags = ko.observableArray<AbstractRef>(); // git-ref
  branchesAndLocalTags = ko.observableArray<AbstractRef>(); // git-ref
  refs = ko.computed<AbstractRef[]>(() => { // git-ref[]
    const rs = this.branchesAndLocalTags().concat(this.remoteTags());
    rs.sort((a, b) => {
      if (b.current()) return 1;
      if (a.current()) return -1;
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return a.refName < b.refName ? -1 : 1;
    });
    return rs;
  });
  branches = ko.observableArray<AbstractRef>(); // git-ref
  branchesToDisplay = ko.observableArray<AbstractRef>(); // git-ref
  tags = ko.observableArray<AbstractRef>(); // git-ref
  tagsToDisplay = ko.observableArray<AbstractRef>(); // git-ref

  // graph variables
  color = ko.observable<string>();
  ancestorOfHEAD = ko.observable(false);
  commitContainerVisible: ko.Computed<boolean>
  isEdgeHighlighted = ko.observable(false);
  isNodeAccented = ko.computed(() => this.selected() || this.isEdgeHighlighted());
  showNewRefAction: ko.Computed<boolean>
  showRefSearch = ko.computed(
    () => this.branches().length + this.tags().length > ungit.config.numRefsToShow
  );
  newBranchName = ko.observable<string>();
  newBranchNameHasFocus = ko.observable(true);
  branchingFormVisible = ko.observable(false);
  canCreateRef = ko.computed(
    () =>
      this.newBranchName() && this.newBranchName().trim() && !this.newBranchName().includes(' ')
  );
  branchOrder = ko.observable<number>();
  aboveNode: NodeViewModel = undefined;
  belowNode: NodeViewModel = undefined;
  refSearchFormVisible = ko.observable(false);
  r: ko.Observable<number>
  cx: ko.Observable<number>
  cy: ko.Observable<number>
  getGraphAttr = ko.computed(() => {
    return [this.cx(), this.cy()]
  })
  dropareaGraphActions: ActionBase[] // graph actions

  commitComponent: any

  constructor(nodesEdges: AbstractNodesEdges, sha1: string) {
    super(nodesEdges.graph);
    this.sha1 = sha1;
    this.nodesEdges = nodesEdges;
    this.refs.subscribe((newValue) => {
      if (newValue) {
        this.branches(newValue.filter((r) => r.isBranch));
        this.tags(newValue.filter((r) => r.isTag));
        this.branchesToDisplay(
          this.branches.slice(
            0,
            ungit.config.numRefsToShow - Math.min(this.tags().length, maxTagsToDisplay)
          )
        );
        this.tagsToDisplay(
          this.tags.slice(0, ungit.config.numRefsToShow - this.branchesToDisplay().length)
        );
      } else {
        this.branches.removeAll();
        this.tags.removeAll();
        this.branchesToDisplay.removeAll();
        this.tagsToDisplay.removeAll();
      }
    });
    this.selected.subscribe(() => {
      ungit.programEvents.dispatch({ event: 'graph-render' });
    });
    this.dropareaGraphActions = [
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
    this.commitComponent = components.create('commit', this);
    this.r = ko.observable<number>();
    this.cx = ko.observable<number>();
    this.cy = ko.observable<number>();
    this.commitContainerVisible = ko.computed(
      () => {
        return this.ancestorOfHEAD() || this.nodeIsMousehover() || this.selected();
      }
    );
    this.showNewRefAction = ko.computed(() => {
      return !this.graph.currentActionContext();
    });

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

    if (this.aboveNode && this.aboveNode.selected()) {
      this.cy(this.aboveNode.cy() + this.aboveNode.commitComponent.element().offsetHeight + 30);
    }

    this.color(this.ideologicalBranch() ? this.ideologicalBranch().color : '#666');
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
      this.graph.getRef(ref).node(this);
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
          const ray = ref.isTag ? this.tagsToDisplay : this.branchesToDisplay;

          // if ref is in display, remove it, else remove last in array.
          ray.splice(ray.indexOf(ref), 1);
          ray.unshift(ref);
          this.refSearchFormVisible(false);

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
        this.graph.getRef(`refs/heads/${this.newBranchName()}`).node(this);
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
      .then(() => this.graph.getRef(`refs/tags/${this.newBranchName()}`).node(this))
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
      if (beforeThisCR.top < 0 && belowY) {
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

  removeRef(ref) {
    if (ref.isRemoteTag) {
      this.remoteTags.remove(ref);
    } else {
      this.branchesAndLocalTags.remove(ref);
    }
  }

  pushRef(ref) {
    if (ref.isRemoteTag && !this.remoteTags().includes(ref)) {
      this.remoteTags.push(ref);
    } else if (!this.branchesAndLocalTags().includes(ref)) {
      this.branchesAndLocalTags.push(ref);
    }
  }

  updateAnimationFrame(deltaT) {
    this.commitComponent.updateAnimationFrame(deltaT);
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

  isViewable() {
    return this.version === this.nodesEdges._latestNodeVersion;
  }
}
