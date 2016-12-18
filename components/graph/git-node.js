var ko = require('knockout');
var components = require('ungit-components');
var Selectable = require('./selectable');
var Animateable = require('./animateable');
var programEvents = require('ungit-program-events');
var GraphActions = require('./git-graph-actions');

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
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return a.refName < b.refName ? -1 : 1;
    });
    return rs;
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
  // These are split up like this because branches and local tags can be found in the git log,
  // whereas remote tags needs to be fetched with another command (which is much slower)
  this.branches = ko.computed(function() {
    return self.refs().filter(function(r) { return r.isBranch; });
  });
  this.tags = ko.computed(function() {
    return self.refs().filter(function(r) { return r.isTag; });
  });
  this.showNewRefAction = ko.computed(function() {
    return !graph.currentActionContext();
  });
  this.newBranchName = ko.observable();
  this.newBranchNameHasFocus = ko.observable(true);
  this.newBranchNameHasFocus.subscribe(function(newValue) {
    if (!newValue) {
      // Small timeout because in ff the form is hidden before the submit click event is registered otherwise
      setTimeout(function() {
        self.branchingFormVisible(false);
      }, 200);
    }
  });
  this.branchingFormVisible = ko.observable(false);
  this.canCreateRef = ko.computed(function() {
    return self.newBranchName() && self.newBranchName().trim() && self.newBranchName().indexOf(' ') == -1;
  });
  this.branchOrder = ko.observable();
  this.aboveNode = undefined;
  this.belowNode = undefined;
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
    new GraphActions.Revert(this.graph, this)
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
GitNodeViewModel.prototype.createBranch = function() {
  if (!this.canCreateRef()) return;
  var self = this;
  var command = ungit.config.autoCheckoutOnBranchCreate ? "/checkout" : "/branches";

  this.graph.server.postPromise(command, { path: this.graph.repoPath(), name: this.newBranchName(), sha1: this.sha1 })
    .then(function() {
      self.graph.getRef('refs/heads/' + self.newBranchName()).node(self);
    }).finally(function() {
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
      var newRef = self.graph.getRef('tag: refs/tags/' + self.newBranchName());
      newRef.node(self);
    }).finally(function() {
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
