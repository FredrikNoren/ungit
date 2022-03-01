const $ = require('jquery');
const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const Animateable = require('./animateable');
const {
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
} = require('./git-graph-actions');

const maxBranchesToDisplay = parseInt((ungit.config.numRefsToShow / 5) * 3); // 3/5 of refs to show to branches
const maxTagsToDisplay = ungit.config.numRefsToShow - maxBranchesToDisplay; // 2/5 of refs to show to tags

class GitNodeViewModel extends Animateable {
  constructor(nodesEdges, sha1) {
    super(nodesEdges.graph);
    this.nodesEdges = nodesEdges;
    this.ancestorOfHEADTimeStamp = undefined;
    this.version = undefined;
    this.sha1 = sha1;
    this.isInited = false;
    this.title = ko.observable();
    this.parents = ko.observableArray();
    this.commitTime = undefined; // commit time in string
    this.date = undefined; // commit time in numeric format for sort
    this.color = ko.observable();
    this.ideologicalBranch = ko.observable();
    this.remoteTags = ko.observableArray();
    this.branchesAndLocalTags = ko.observableArray();
    this.signatureDate = ko.observable();
    this.signatureMade = ko.observable();
    this.pgpVerifiedString = ko.computed(() => {
      if (this.signatureMade()) {
        return `PGP by: ${this.signatureMade()} at ${this.signatureDate()}`;
      }
    });

    this.refs = ko.computed(() => {
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
    // These are split up like this because branches and local tags can be found in the git log,
    // whereas remote tags needs to be fetched with another command (which is much slower)
    this.branches = ko.observableArray();
    this.branchesToDisplay = ko.observableArray();
    this.tags = ko.observableArray();
    this.tagsToDisplay = ko.observableArray();
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
    this.ancestorOfHEAD = ko.observable(false);
    this.nodeIsMousehover = ko.observable(false);
    this.commitContainerVisible = ko.computed(
      () => this.ancestorOfHEAD() || this.nodeIsMousehover() || this.selected()
    );
    this.isEdgeHighlighted = ko.observable(false);
    // for small empty black circle to highlight a node
    this.isNodeAccented = ko.computed(() => this.selected() || this.isEdgeHighlighted());
    this.selected.subscribe(() => {
      programEvents.dispatch({ event: 'graph-render' });
    });
    this.showNewRefAction = ko.computed(() => !nodesEdges.graph.currentActionContext());
    this.showRefSearch = ko.computed(
      () => this.branches().length + this.tags().length > ungit.config.numRefsToShow
    );
    this.newBranchName = ko.observable();
    this.newBranchNameHasFocus = ko.observable(true);
    this.branchingFormVisible = ko.observable(false);
    this.canCreateRef = ko.computed(
      () =>
        this.newBranchName() && this.newBranchName().trim() && !this.newBranchName().includes(' ')
    );
    this.branchOrder = ko.observable();
    this.aboveNode = undefined;
    this.belowNode = undefined;
    this.refSearchFormVisible = ko.observable(false);
    this.commitComponent = components.create('commit', this);
    this.r = ko.observable();
    this.cx = ko.observable();
    this.cy = ko.observable();

    this.dropareaGraphActions = [
      new Move(this.nodesEdges.graph, this),
      new Rebase(this.nodesEdges.graph, this),
      new Merge(this.nodesEdges.graph, this),
      new Push(this.nodesEdges.graph, this),
      new Reset(this.nodesEdges.graph, this),
      new Checkout(this.nodesEdges.graph, this),
      new Delete(this.nodesEdges.graph, this),
      new CherryPick(this.nodesEdges.graph, this),
      new Uncommit(this.nodesEdges.graph, this),
      new Revert(this.nodesEdges.graph, this),
      new Squash(this.nodesEdges.graph, this),
    ];
  }

  getGraphAttr() {
    return [this.cx(), this.cy()];
  }

  setGraphAttr(val) {
    this.element().setAttribute('x', val[0] - 30);
    this.element().setAttribute('y', val[1] - 30);
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
      this.nodesEdges.graph.getRef(ref).node(this);
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
    const $textBox = $(textBox);

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
        $(event.target).autocomplete('search', event.target.value);
      });
      $textBox.autocomplete('search', '');
    }
  }

  createBranch() {
    if (!this.canCreateRef()) return;
    this.nodesEdges.graph.server
      .postPromise('/branches', {
        path: this.nodesEdges.graph.repoPath(),
        name: this.newBranchName(),
        sha1: this.sha1,
      })
      .then(() => {
        this.nodesEdges.graph.getRef(`refs/heads/${this.newBranchName()}`).node(this);
        if (ungit.config.autoCheckoutOnBranchCreate) {
          return this.nodesEdges.graph.server.postPromise('/checkout', {
            path: this.nodesEdges.graph.repoPath(),
            name: this.newBranchName(),
          });
        }
      })
      .catch((e) => this.nodesEdges.graph.server.unhandledRejection(e))
      .finally(() => {
        this.branchingFormVisible(false);
        this.newBranchName('');
        programEvents.dispatch({ event: 'branch-updated' });
      });
  }

  createTag() {
    if (!this.canCreateRef()) return;
    this.nodesEdges.graph.server
      .postPromise('/tags', {
        path: this.nodesEdges.graph.repoPath(),
        name: this.newBranchName(),
        sha1: this.sha1,
      })
      .then(() => this.nodesEdges.graph.getRef(`refs/tags/${this.newBranchName()}`).node(this))
      .catch((e) => this.nodesEdges.graph.server.unhandledRejection(e))
      .finally(() => {
        this.branchingFormVisible(false);
        this.newBranchName('');
      });
  }

  toggleSelected() {
    console.log('>>>>>9918283')
    const beforeThisCR = this.commitComponent.element().getBoundingClientRect();
    const belowY = this.belowNode ? this.belowNode.cy() : undefined;

    let prevSelected = this.nodesEdges.graph.currentActionContext();
    if (!(prevSelected instanceof GitNodeViewModel)) prevSelected = null;
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

  getPathToCommonAncestor(node) {
    const path = [];
    let thisNode = this;
    while (thisNode && !node.isAncestor(thisNode)) {
      path.push(thisNode);
      thisNode = this.nodesEdges.nodesById[thisNode.parents()[0]];
    }
    if (thisNode) path.push(thisNode);
    return path;
  }

  isAncestor(node) {
    if (node == this) return true;
    for (const v in this.parents()) {
      const n = this.nodesEdges.nodesById[this.parents()[v]];
      if (n && n.isAncestor(node)) return true;
    }
    return false;
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
    return this.nodesEdges.nodesById[this.sha1].version === this.nodesEdges._latestNodeVersion;
  }
}

module.exports = GitNodeViewModel;
