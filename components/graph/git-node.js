const $ = require('jquery');
const ko = require('knockout');
const components = require('ungit-components');
const Selectable = require('./selectable');
const Animateable = require('./animateable');
const programEvents = require('ungit-program-events');
const GraphActions = require('./git-graph-actions');

const maxBranchesToDisplay = parseInt(ungit.config.numRefsToShow / 5 * 3);  // 3/5 of refs to show to branches
const maxTagsToDisplay = ungit.config.numRefsToShow - maxBranchesToDisplay; // 2/5 of refs to show to tags

class GitNodeViewModel extends Animateable {
  constructor(graph, sha1) {
    super(graph);
    this.graph = graph;
    this.sha1 = sha1;
    this.isInited = false;
    this.title = ko.observable();
    this.parents = ko.observableArray();
    this.commitTime = undefined; // commit time in string
    this.date = undefined;       // commit time in numeric format for sort
    this.color = ko.observable();
    this.ideologicalBranch = ko.observable();
    this.remoteTags = ko.observableArray();
    this.branchesAndLocalTags = ko.observableArray();
    this.signatureDate = ko.observable();
    this.signatureMade = ko.observable();
    this.pgpVerifiedString = ko.computed(() => {
      if (this.signatureMade()) {
        return `PGP by: ${this.signatureMade()} at ${this.signatureDate()}`
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
        this.tagsToDisplay(this.tags.slice(0, maxTagsToDisplay));
        this.branchesToDisplay(this.branches.slice(0, ungit.config.numRefsToShow - this.tagsToDisplay().length));
      } else {
        this.branches.removeAll();
        this.tags.removeAll();
        this.branchesToDisplay.removeAll();
        this.tagsToDisplay.removeAll();
      }
    });
    this.ancestorOfHEAD = ko.observable(false);
    this.nodeIsMousehover = ko.observable(false);
    this.commitContainerVisible = ko.computed(() => this.ancestorOfHEAD() || this.nodeIsMousehover() || this.selected());
    this.isEdgeHighlighted = ko.observable(false);
    // for small empty black circle to highlight a node
    this.isNodeAccented = ko.computed(() => this.selected() || this.isEdgeHighlighted());
    // to show changed files and diff boxes on the left of node
    this.highlighted = ko.computed(() => this.nodeIsMousehover() || this.selected());
    this.selected.subscribe(() => {
      programEvents.dispatch({ event: 'graph-render' });
    });
    this.showNewRefAction = ko.computed(() => !graph.currentActionContext());
    this.newBranchName = ko.observable();
    this.newBranchNameHasFocus = ko.observable(true);
    this.branchingFormVisible = ko.observable(false);
    this.newBranchNameHasFocus.subscribe(newValue => {
      if (!newValue) {
        // Small timeout because in ff the form is hidden before the submit click event is registered otherwise
        setTimeout(() => {
          this.branchingFormVisible(false);
        }, 200);
      }
    });
    this.canCreateRef = ko.computed(() => this.newBranchName() && this.newBranchName().trim() && !this.newBranchName().includes(' '));
    this.branchOrder = ko.observable();
    this.aboveNode = undefined;
    this.belowNode = undefined;
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
      new GraphActions.Squash(this.graph, this)
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
      this.cx(610 + (90 * this.branchOrder()));
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

    (logEntry.refs || []).forEach(ref => {
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

    const textBox = event.target.nextElementSibling.firstElementChild; // this may not be the best idea...
    $(textBox).autocomplete({
      source: this.refs().filter(ref => !ref.isHEAD),
      minLength: 0,
      select: (event, ui) => {
        const ref = ui.item;
        const ray = ref.isTag ? this.tagsToDisplay : this.branchesToDisplay;

        // if ref is in display, remove it, else remove last in array.
        ray.splice(ray.indexOf(ref), 1);
        ray.unshift(ref);
        this.refSearchFormVisible(false);
      },
      messages: {
        noResults: '',
        results: () => {}
      }
    }).focus(() => {
      $(this).autocomplete('search', $(this).val());
    }).data("ui-autocomplete")._renderItem = (ul, item) => $("<li></li>")
      .append(`<a>${item.dom}</a>`)
      .appendTo(ul)
    $(textBox).autocomplete('search', '');
  }

  createBranch() {
    if (!this.canCreateRef()) return;
    this.graph.server.postPromise("/branches", { path: this.graph.repoPath(), name: this.newBranchName(), sha1: this.sha1 })
      .then(() => {
        this.graph.getRef(`refs/heads/${this.newBranchName()}`).node(this)
        if (ungit.config.autoCheckoutOnBranchCreate) {
          return this.graph.server.postPromise("/checkout", { path: this.graph.repoPath(), name: this.newBranchName() })
        }
      }).catch((e) => this.graph.server.unhandledRejection(e))
      .finally(() => {
        this.branchingFormVisible(false);
        this.newBranchName('');
        programEvents.dispatch({ event: 'branch-updated' });
      });
  }

  createTag() {
    if (!this.canCreateRef()) return;
    this.graph.server.postPromise('/tags', { path: this.graph.repoPath(), name: this.newBranchName(), sha1: this.sha1 })
      .then(() => this.graph.getRef(`refs/tags/${this.newBranchName()}`).node(this) )
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

    let prevSelected  = this.graph.currentActionContext();
    if (!(prevSelected instanceof GitNodeViewModel)) prevSelected = null;
    const prevSelectedCR = prevSelected ? prevSelected.commitComponent.element().getBoundingClientRect() : null;
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
      if ((prevSelectedCR && (prevSelectedCR.top < 0 || prevSelectedCR.top > window.innerHeight)) &&
        afterThisCR.top != beforeThisCR.top) {
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
    } else if(!this.branchesAndLocalTags().includes(ref)) {
      this.branchesAndLocalTags.push(ref);
    }
  }

  getPathToCommonAncestor(node) {
    const path = [];
    let thisNode = this;
    while (thisNode && !node.isAncestor(thisNode)) {
      path.push(thisNode);
      thisNode = this.graph.nodesById[thisNode.parents()[0]];
    }
    if (thisNode) path.push(thisNode);
    return path;
  }

  isAncestor(node) {
    if (node == this) return true;
    for (const v in this.parents()) {
      const n = this.graph.nodesById[this.parents()[v]];
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
    return this.graph.nodes().includes(this);
  }
}

module.exports = GitNodeViewModel;
