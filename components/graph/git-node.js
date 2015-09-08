var ko = require('knockout');
var components = require('ungit-components');
var Selectable = require('./selectable');
var programEvents = require('ungit-program-events');
var GraphActions = require('./git-graph-actions');

var GitNodeViewModel = function(graph, sha1) {
  var self = this;
  Selectable.call(this, graph);
  this.graph = graph;
  this.sha1 = sha1;
  this.isInited = false;
  this.title = ko.observable();
  this.parents = ko.observableArray();
  this.commitTime = ko.observable();
  this.color = ko.observable();
  this.ideologicalBranch = ko.observable();
  this.ideologicalBranch.subscribe(function(value) {
    self.color(value ? value.color : '#666');
  });
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
  this.commitComponent = components.create('commit', {
    sha1: this.sha1,
    repoPath: this.graph.repoPath,
    server: this.graph.server
  });
  
  this.ancestorOfHEAD = ko.observable(false);
  this.nodeIsMousehover = ko.observable(false);
  this.nodeIsMousehover.subscribe(function(value) {
    self.commitComponent.nodeIsMousehover(value);
  });
  this.commitContainerVisible = ko.computed(function() {
    return self.ancestorOfHEAD() || self.nodeIsMousehover() || self.selected();
  });
  this.highlighted = ko.computed(function() {
    return self.nodeIsMousehover() || self.selected();
  });
  this.highlighted.subscribe(function(value) {
    self.commitComponent.highlighted(value);
  });
  this.selected.subscribe(function(value) {
    self.commitComponent.selected(value);
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
  this.aboveNode = ko.observable();
  
  this.r = ko.computed(function() {
    return self.ancestorOfHEAD() ? 30 : 15;
  });
  
  this.cx = ko.computed(function() {
    return self.ancestorOfHEAD() ? 610 : 610 + (90 * self.branchOrder());
  });
  
  this.cy = ko.computed(function() {
    if (self.aboveNode() && self.aboveNode().selected()) {
      return self.aboveNode().cy() + self.aboveNode().commitComponent.element().offsetHeight + 30;
    }
    
    if (self.ancestorOfHEAD()) {
      if (!self.aboveNode()) {
        return 120;
      } else if (self.aboveNode().ancestorOfHEAD()) {
        return self.aboveNode().cy() + 120;
      } else {
        return self.aboveNode().cy() + 60;
      }
    } else {
      return self.aboveNode() ? self.aboveNode().cy() + 60 : 120;
    }
  });
  
  this.cx.subscribe(function(value) {
    self.commitComponent.selectedDiffLeftPosition(-(value - 600));
  });

  this.dropareaGraphActions = [
    new GraphActions.Move(this.graph, this),
    // new GraphActions.Rebase(this.graph, this),
    // new GraphActions.Merge(this.graph, this),
    // new GraphActions.Push(this.graph, this),
    // new GraphActions.Reset(this.graph, this),
    new GraphActions.Checkout(this.graph, this),
    new GraphActions.Delete(this.graph, this),
    new GraphActions.CherryPick(this.graph, this),
    new GraphActions.Uncommit(this.graph, this),
    new GraphActions.Revert(this.graph, this)
  ];
}
module.exports = GitNodeViewModel;

GitNodeViewModel.prototype.setData = function(logEntry) {
  var self = this;
  this.title(logEntry.message.split('\n')[0]);
  this.parents(logEntry.parents || []);
  this.commitTime(logEntry.commitDate);
  this.commitComponent.setData(logEntry);
  
  if (logEntry.refs) {
    var refVMs = logEntry.refs.map(function(ref) {
      var refViewModel = self.graph.getRef(ref);
      refViewModel.node(self);
      return refViewModel;
    });
    this.branchesAndLocalTags(refVMs);
  }
  
  this.isInited = true;
}
GitNodeViewModel.prototype.showBranchingForm = function() {
  this.branchingFormVisible(true);
  this.newBranchNameHasFocus(true);
}
GitNodeViewModel.prototype.createBranch = function() {
  if (!this.canCreateRef()) return;
  var self = this;
  this.graph.server.queryPromise('POST', '/branches', { path: this.graph.repoPath, name: this.newBranchName(), startPoint: this.sha1 })
    .then(function() {
      var newRef = self.graph.getRef('refs/heads/' + self.newBranchName());
      newRef.node(self);
      self.branchesAndLocalTags.push(newRef);
    }).finally(function() {
      self.branchingFormVisible(false);
      self.newBranchName('');
      programEvents.dispatch({ event: 'branch-updated' });
    });
}
GitNodeViewModel.prototype.createTag = function() {
  if (!this.canCreateRef()) return;
  var self = this;
  this.graph.server.queryPromise('POST', '/tags', { path: this.graph.repoPath, name: this.newBranchName(), startPoint: this.sha1 })
    .then(function() {
      var newRef = self.graph.getRef('tag: refs/tags/' + self.newBranchName());
      newRef.node(self);
      self.branchesAndLocalTags.push(newRef);
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
      console.log('Fix')
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
  if (ref.isRemoteTag) {
    this.remoteTags.push(ref);
  } else {
    this.branchesAndLocalTags.push(ref);
  }
}
