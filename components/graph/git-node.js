const ko = require('knockout');
const components = require('ungit-components');
const Selectable = require('./selectable');
const Animateable = require('./animateable');
const programEvents = require('ungit-program-events');
const GraphActions = require('./git-graph-actions');

const maxBranchesToDisplay = parseInt(ungit.config.numRefsToShow / 5 * 3);  // 3/5 of refs to show to branches
const maxTagsToDisplay = ungit.config.numRefsToShow - maxBranchesToDisplay; // 2/5 of refs to show to tags

var GitNodeViewModel = function(graph, sha1) {
  var self = this;
  Selectable.call(this, graph);
  Animateable.call(this);
  this.graph = graph;
  this.sha1 = sha1;
  this.isInited = false;
  this.title = undefined;
  this.parents = ko.observableArray();
  this.commitTime = undefined; // commit time in string
  this.date = undefined;       // commit time in numeric format for sort
  this.color = ko.observable();
  this.ideologicalBranch = ko.observable();
  this.remoteTags = ko.observableArray();
  this.branchesAndLocalTags = ko.observableArray();

  this.refs = ko.computed(function() {
    var rs = self.branchesAndLocalTags().concat(self.remoteTags());
    rs.sort(function(a, b) {
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
  this.commitContainerVisible = ko.computed(function() {
    return self.ancestorOfHEAD() || self.nodeIsMousehover() || self.selected();
  });
  this.highlighted = ko.computed(function() {
    return self.nodeIsMousehover() || self.selected();
  });
  this.selected.subscribe(function() {
    programEvents.dispatch({ event: 'graph-render' });
  });
  this.showNewRefAction = ko.computed(function() {
    return !graph.currentActionContext();
  });
  this.newBranchName = ko.observable();
  this.newBranchNameHasFocus = ko.observable(true);
  this.branchingFormVisible = ko.observable(false);
  this.newBranchNameHasFocus.subscribe(function(newValue) {
    if (!newValue) {
      // Small timeout because in ff the form is hidden before the submit click event is registered otherwise
      setTimeout(function() {
        self.branchingFormVisible(false);
      }, 200);
    }
  });
  this.canCreateRef = ko.computed(function() {
    return self.newBranchName() && self.newBranchName().trim() && self.newBranchName().indexOf(' ') == -1;
  });
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
module.exports = GitNodeViewModel;

GitNodeViewModel.prototype.getGraphAttr = function() {
  return [this.cx(), this.cy()];
}
GitNodeViewModel.prototype.setGraphAttr = function(val) {
  this.element().setAttribute('x', val[0] - 30);
  this.element().setAttribute('y', val[1] - 30);
}
GitNodeViewModel.prototype.render = function() {
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
GitNodeViewModel.prototype.setData = function(logEntry) {
  var self = this;
  this.title = logEntry.message.split('\n')[0];
  this.parents(logEntry.parents || []);
  this.commitTime = logEntry.commitDate;
  this.date = Date.parse(this.commitTime);
  this.commitComponent.setData(logEntry);

  (logEntry.refs || []).forEach(function(ref) {
    self.graph.getRef(ref).node(self);
  });
  this.isInited = true;
}
GitNodeViewModel.prototype.showBranchingForm = function() {
  this.branchingFormVisible(true);
  this.newBranchNameHasFocus(true);
}
GitNodeViewModel.prototype.showRefSearchForm = function(obj, event) {
  const self = this;
  this.refSearchFormVisible(true);

  const textBox = event.target.nextElementSibling.firstElementChild; // this may not be the best idea...
  $(textBox).autocomplete({
    source: this.refs().filter(ref => !ref.isHEAD),
    minLength: 0,
    select: function(event, ui) {
      const ref = ui.item;
      const ray = ref.isTag ? self.tagsToDisplay : self.branchesToDisplay;

      // if ref is in display, remove it, else remove last in array.
      ray.splice(ray.indexOf(ref), 1);
      ray.unshift(ref);
      self.refSearchFormVisible(false);
    },
    messages: {
      noResults: '',
      results: () => {}
    }
  }).focus(function() {
    $(this).autocomplete('search', $(this).val());
  }).data("ui-autocomplete")._renderItem = function (ul, item) {
    return $("<li></li>")
      .data("item.autocomplete", item)
      .append(`<a>${item.dom}</a>`)
      .appendTo(ul);
  }
  $(textBox).autocomplete('search', '');
}
GitNodeViewModel.prototype.createBranch = function() {
  if (!this.canCreateRef()) return;
  var self = this;
  var command = ungit.config.autoCheckoutOnBranchCreate ? "/checkout" : "/branches";

  this.graph.server.postPromise(command, { path: this.graph.repoPath(), name: this.newBranchName(), sha1: this.sha1 })
    .then(function() {
      self.graph.getRef('refs/heads/' + self.newBranchName()).node(self);
    }).catch((e) => this.server.unhandledRejection(e))
    .finally(function() {
      self.branchingFormVisible(false);
      self.newBranchName('');
      programEvents.dispatch({ event: 'branch-updated' });
    });
}
GitNodeViewModel.prototype.createTag = function() {
  if (!this.canCreateRef()) return;
  var self = this;
  this.graph.server.postPromise('/tags', { path: this.graph.repoPath(), name: this.newBranchName(), sha1: this.sha1 })
    .then(function() {
      var newRef = self.graph.getRef('refs/tags/' + self.newBranchName());
      newRef.node(self);
    }).catch((e) => this.server.unhandledRejection(e))
    .finally(function() {
      self.branchingFormVisible(false);
      self.newBranchName('');
    });
}
GitNodeViewModel.prototype.toggleSelected = function() {
  var self = this;
  var beforeThisCR = this.commitComponent.element().getBoundingClientRect();
  var beforeBelowCR = null;
  if (this.belowNode) {
    beforeBelowCR = this.belowNode.commitComponent.element().getBoundingClientRect();
  }

  var prevSelected  = this.graph.currentActionContext();
  if (!(prevSelected instanceof GitNodeViewModel)) prevSelected = null;
  var prevSelectedCR = prevSelected ? prevSelected.commitComponent.element().getBoundingClientRect() : null;
  this.selected(!this.selected());

  // If we are deselecting
  if (!this.selected()) {
    if (beforeThisCR.top < 0 && beforeBelowCR) {
      var afterBelowCR = this.belowNode.commitComponent.element().getBoundingClientRect();
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
    var afterThisCR = this.commitComponent.element().getBoundingClientRect();
    if ((prevSelectedCR && (prevSelectedCR.top < 0 || prevSelectedCR.top > window.innerHeight)) &&
      afterThisCR.top != beforeThisCR.top) {
      window.scrollBy(0, -(beforeThisCR.top - afterThisCR.top));
      console.log('Fix');
    }
  }
  return false;
}
GitNodeViewModel.prototype.removeRef = function(ref) {
  if (ref.isRemoteTag) {
    this.remoteTags.remove(ref);
  } else {
    this.branchesAndLocalTags.remove(ref);
  }
}
GitNodeViewModel.prototype.pushRef = function(ref) {
  if (ref.isRemoteTag && this.remoteTags.indexOf(ref) < 0) {
    this.remoteTags.push(ref);
  } else if(this.branchesAndLocalTags.indexOf(ref) < 0) {
    this.branchesAndLocalTags.push(ref);
  }
}
GitNodeViewModel.prototype.getPathToCommonAncestor = function(node) {
  var path = [];
  var thisNode = this;
  while (thisNode && !node.isAncestor(thisNode)) {
    path.push(thisNode);
    thisNode = this.graph.nodesById[thisNode.parents()[0]];
  }
  if (thisNode) path.push(thisNode);
  return path;
}
GitNodeViewModel.prototype.isAncestor = function(node) {
  if (node == this) return true;
  for (var v in this.parents()) {
    var n = this.graph.nodesById[this.parents()[v]];
    if (n && n.isAncestor(node)) return true;
  }
  return false;
}
GitNodeViewModel.prototype.getRightToLeftStrike = function() {
  return 'M ' + (this.cx() - 30) + ' ' + (this.cy() - 30) + ' L ' + (this.cx() + 30) + ' ' + (this.cy() + 30);
}
GitNodeViewModel.prototype.getLeftToRightStrike = function() {
  return 'M ' + (this.cx() + 30) + ' ' + (this.cy() - 30) + ' L ' + (this.cx() - 30) + ' ' + (this.cy() + 30);
}
GitNodeViewModel.prototype.nodeMouseover = function() {
  this.nodeIsMousehover(true);
}
GitNodeViewModel.prototype.nodeMouseout = function() {
  this.nodeIsMousehover(false);
}
GitNodeViewModel.prototype.isViewable = function() {
  return this.graph.nodes().indexOf(this) > -1;
}
