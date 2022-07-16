const $ = require('jquery');
const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const Animateable = require('./animateable');
const GraphActions = require('./git-graph-actions');

const maxBranchesToDisplay = Math.ceil((ungit.config.numRefsToShow * 3) / 5) || 4; // 3/5 of refs to show to branches
const maxTagsToDisplay = ungit.config.numRefsToShow - maxBranchesToDisplay; // 2/5 of refs to show to tags

class GitNodeViewModel extends Animateable {
  constructor(graph, sha1) {
    super(graph);
    this.graph = graph;
    this.sha1 = /** @type {Hash} */ sha1;
    /* calcNodes data */
    this.order = -1;
    this.line = -1;
    this.slot = ko.observable(0);
    this.aboveNode = /** @type {GraphNode} */ (null);
    this.belowNode = /** @type {GraphNode} */ (null);
    this.ideologicalBranch = ko.observable(/** @type {GraphRef} */ (null));
    /* calcNodes data end */
    this.isInited = ko.observable(false);
    this.title = ko.observable('');
    this.parents = ko.observableArray(/** @type {GraphNode[]} */ ([]));
    this.commitTime = ''; // commit time in string
    this.date = /** @type {number} */ (null); // commit time in numeric format for sort
    this.color = ko.observable('');
    this.remoteTags = ko.observableArray(/** @type {GraphRef[]} */ ([]));
    this.branchesAndLocalTags = ko.observableArray(/** @type {GraphRef[]} */ ([]));
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
      return /** @type {GraphRef[]} */ (rs);
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
    this.nodeIsMousehover = ko.observable(false);
    this.commitContainerVisible = ko.computed(
      () => this.slot() === 0 || this.nodeIsMousehover() || this.selected()
    );
    this.isEdgeHighlighted = ko.observable(false);
    // for small empty black circle to highlight a node
    this.isNodeAccented = ko.computed(() => this.selected() || this.isEdgeHighlighted());
    // to show changed files and diff boxes on the left of node
    this.highlighted = ko.computed(() => this.nodeIsMousehover() || this.selected());
    this.selected.subscribe(() => {
      programEvents.dispatch({ event: 'graph-render' });
    });
    this.showNewRefAction = ko.computed(() => !graph.currentActionContext());
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
    this.refSearchFormVisible = ko.observable(false);
    this.commitComponent = components.create('commit', this);
    this.r = ko.observable();
    this.cx = ko.observable();
    this.cy = ko.observable();

    this.dropareaGraphActions = [
      new GraphActions.Move(this.graph, this),
      new GraphActions.Rebase(this.graph, this),
      new GraphActions.Merge(this.graph, this),
      new GraphActions.Push(this.graph, this),
      new GraphActions.Reset(this.graph, this),
      new GraphActions.Checkout(this.graph, this),
      new GraphActions.Delete(this.graph, this),
      new GraphActions.CherryPick(this.graph, this),
      new GraphActions.Uncommit(this.graph, this),
      new GraphActions.Revert(this.graph, this),
      new GraphActions.Squash(this.graph, this),
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
    const slot = this.slot();
    const isMain = slot === 0;
    const prev = this.aboveNode;
    const prevY = prev ? prev.cy() : 0;
    const prevOnMain = prev && prev.slot() === 0;

    const x = 610 + 90 * slot;
    const radius = isMain ? 30 : 15;
    let y;
    if (prev && prev.selected()) {
      y = prevY + prev.commitComponent.element().offsetHeight + 30;
    } else {
      const delayY = prev && prev.date - this.date > 3600000 ? 0 : -15;
      if (isMain) {
        y = prevY + (prevOnMain ? 120 : 60) + delayY;
      } else {
        y = (prev ? prevY + 60 : 120) + delayY;
      }
    }

    this.cx(x);
    this.cy(Math.max(y, 120));
    this.r(radius);
    this.color(this.isInited() ? this.ideologicalBranch().color : '#777');
    this.animate();
  }

  setData(/** @type {Commit} */ logEntry) {
    const { message, parents = [], commitDate, signatureMade, signatureDate } = logEntry;
    this.title(message.split('\n')[0]);
    const pNodes = [];
    // Register parents
    for (const pId of parents) {
      const p = this.graph.getNode(pId);
      if (!pNodes.includes(p)) pNodes.push(p);
    }
    this.parents(pNodes);
    this.commitTime = commitDate;
    this.date = Date.parse(this.commitTime);
    this.commitComponent.setData(logEntry);
    this.signatureMade(signatureMade);
    this.signatureDate(signatureDate);

    this.isInited(true);
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
    this.graph.server
      .postPromise('/branches', {
        path: this.graph.repoPath(),
        name: this.newBranchName(),
        sha1: this.sha1,
      })
      .then(() => {
        this.graph.getRef(`refs/heads/${this.newBranchName()}`, this.sha1);
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
        programEvents.dispatch({ event: 'branch-updated' });
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
      .then(() => this.graph.getRef(`refs/tags/${this.newBranchName()}`, this.sha1))
      .catch((e) => this.graph.server.unhandledRejection(e))
      .finally(() => {
        this.branchingFormVisible(false);
        this.newBranchName('');
      });
  }

  toggleSelected() {
    const beforeThisCR = this.commitComponent.element().getBoundingClientRect();
    let beforeBelowCR = null;
    if (this.belowNode) {
      beforeBelowCR = this.belowNode.commitComponent.element().getBoundingClientRect();
    }

    let prevSelected = this.graph.currentActionContext();
    if (!(prevSelected instanceof GitNodeViewModel)) prevSelected = null;
    const prevSelectedCR = prevSelected
      ? prevSelected.commitComponent.element().getBoundingClientRect()
      : null;
    this.selected(!this.selected());

    // If we are deselecting
    if (!this.selected()) {
      if (beforeThisCR.top < 0 && beforeBelowCR) {
        const afterBelowCR = this.belowNode.commitComponent.element().getBoundingClientRect();
        // If the next node is showing, try to keep it in the screen (no jumping)
        if (beforeBelowCR.top < window.innerHeight) {
          window.scrollBy(0, afterBelowCR.top - beforeBelowCR.top);
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
    let thisNode = /** @type {GraphNode} */ (this);
    while (thisNode && !node.isAncestor(thisNode)) {
      path.push(thisNode);
      thisNode = thisNode.parents()[0];
    }
    if (thisNode) path.push(thisNode);
    return path;
  }

  isAncestor(node) {
    if (node == this) return true;
    for (const v in this.parents()) {
      const n = this.parents()[v];
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
}

module.exports = GitNodeViewModel;
