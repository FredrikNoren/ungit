
var ko = require('knockout');
var inherits = require('util').inherits;
var components = require('ungit-components');
var Promise = require('bluebird');
var RefViewModel = require('./git-ref.js');
var HoverActions = require('./hover-actions');
var programEvents = require('ungit-program-events');
var RebaseViewModel = HoverActions.RebaseViewModel;
var MergeViewModel = HoverActions.MergeViewModel;
var ResetViewModel = HoverActions.ResetViewModel;
var PushViewModel = HoverActions.PushViewModel;
var SquashViewModel = HoverActions.SquashViewModel;

var GraphActions = {};
module.exports = GraphActions;

GraphActions.ActionBase = function(graph) {
  this.graph = graph;
  this.server = graph.server;
  this.isRunning = ko.observable(false);
  this.isHighlighted = ko.computed(() => {
    return !graph.hoverGraphAction() || graph.hoverGraphAction() == this;
  });
  this.cssClasses = ko.computed(() => {
    if (!this.isHighlighted() || this.isRunning()) {
      return `${this.style} dimmed`
    } else {
      return this.style
    }
  })
}
GraphActions.ActionBase.prototype.icon = null;
GraphActions.ActionBase.prototype.doPerform = function() {
  if (this.isRunning()) return;
  this.graph.hoverGraphAction(null);
  this.isRunning(true);
  return this.perform()
    .catch((e) => this.server.unhandledRejection(e))
    .finally(() => { this.isRunning(false); });
}
GraphActions.ActionBase.prototype.dragEnter = function() {
  if (!this.visible()) return;
  this.graph.hoverGraphAction(this);
}
GraphActions.ActionBase.prototype.dragLeave = function() {
  if (!this.visible()) return;
  this.graph.hoverGraphAction(null);
}
GraphActions.ActionBase.prototype.mouseover = function() {
  this.graph.hoverGraphAction(this);
}
GraphActions.ActionBase.prototype.mouseout = function() {
  this.graph.hoverGraphAction(null);
}

GraphActions.Move = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    return self.graph.currentActionContext() instanceof RefViewModel &&
      self.graph.currentActionContext().node() != self.node;
  });
}
inherits(GraphActions.Move, GraphActions.ActionBase);
GraphActions.Move.prototype.text = 'Move';
GraphActions.Move.prototype.style = 'move';
GraphActions.Move.prototype.icon = 'glyphicon glyphicon-move';
GraphActions.Move.prototype.perform = function() {
  return this.graph.currentActionContext().moveTo(this.node.sha1);
}

GraphActions.Reset = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    if (!(self.graph.currentActionContext() instanceof RefViewModel)) return false;
    var context = self.graph.currentActionContext();
    if (context.node() != self.node) return false;
    var remoteRef = context.getRemoteRef(self.graph.currentRemote());
    return remoteRef && remoteRef.node() &&
      context && context.node() &&
      remoteRef.node() != context.node() &&
      remoteRef.node().date < context.node().date;
  });
}
inherits(GraphActions.Reset, GraphActions.ActionBase);
GraphActions.Reset.prototype.text = 'Reset';
GraphActions.Reset.prototype.style = 'reset';
GraphActions.Reset.prototype.icon = 'glyphicon glyphicon-trash';
GraphActions.Reset.prototype.createHoverGraphic = function() {
  var context = this.graph.currentActionContext();
  if (!context) return null;
  var remoteRef = context.getRemoteRef(this.graph.currentRemote());
  var nodes = context.node().getPathToCommonAncestor(remoteRef.node()).slice(0, -1);
  return new ResetViewModel(nodes);
}
GraphActions.Reset.prototype.perform = function() {
  var self = this;
  var context = this.graph.currentActionContext();
  var remoteRef = context.getRemoteRef(self.graph.currentRemote());
  return components.create('yesnodialog', { title: 'Are you sure?', details: 'Resetting to ref: ' + remoteRef.name + ' cannot be undone with ungit.'})
    .show()
    .closeThen(function(diag) {
      if (!diag.result()) return;
      return self.server.postPromise('/reset', { path: self.graph.repoPath(), to: remoteRef.name, mode: 'hard' })
        .then(function() { context.node(remoteRef.node()); });
    }).closePromise;
}

GraphActions.Rebase = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    return self.graph.currentActionContext() instanceof RefViewModel &&
      (!ungit.config.showRebaseAndMergeOnlyOnRefs || self.node.refs().length > 0) &&
      self.graph.currentActionContext().current() &&
      self.graph.currentActionContext().node() != self.node;
  });
}
inherits(GraphActions.Rebase, GraphActions.ActionBase);
GraphActions.Rebase.prototype.text = 'Rebase';
GraphActions.Rebase.prototype.style = 'rebase';
GraphActions.Rebase.prototype.icon = 'octicon octicon-repo-forked flip';
GraphActions.Rebase.prototype.createHoverGraphic = function() {
  var onto = this.graph.currentActionContext();
  if (!onto) return;
  if (onto instanceof RefViewModel) onto = onto.node();
  var path = onto.getPathToCommonAncestor(this.node);
  return new RebaseViewModel(this.node, path);
}
GraphActions.Rebase.prototype.perform = function() {
  return this.server.postPromise('/rebase', { path: this.graph.repoPath(), onto: this.node.sha1 })
    .catch((err) => { if (err.errorCode != 'merge-failed') this.server.unhandledRejection(err); })
}

GraphActions.Merge = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    if (!self.graph.checkedOutRef() || !self.graph.checkedOutRef().node()) return false;
    return self.graph.currentActionContext() instanceof RefViewModel &&
      !self.graph.currentActionContext().current() &&
      self.graph.checkedOutRef().node() == self.node;
  });
}
inherits(GraphActions.Merge, GraphActions.ActionBase);
GraphActions.Merge.prototype.text = 'Merge';
GraphActions.Merge.prototype.style = 'merge';
GraphActions.Merge.prototype.icon = 'octicon octicon-git-merge';
GraphActions.Merge.prototype.createHoverGraphic = function() {
  var node = this.graph.currentActionContext();
  if (!node) return null;
  if (node instanceof RefViewModel) node = node.node();
  return new MergeViewModel(this.graph, this.node, node);
}
GraphActions.Merge.prototype.perform = function() {
  return this.server.postPromise('/merge', { path: this.graph.repoPath(), with: this.graph.currentActionContext().localRefName })
    .catch((err) => { if (err.errorCode != 'merge-failed') this.server.unhandledRejection(err); })
}

GraphActions.Push = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    return self.graph.currentActionContext() instanceof RefViewModel &&
      self.graph.currentActionContext().node() == self.node &&
      self.graph.currentActionContext().canBePushed(self.graph.currentRemote());
  });
}
inherits(GraphActions.Push, GraphActions.ActionBase);
GraphActions.Push.prototype.text = 'Push';
GraphActions.Push.prototype.style = 'push';
GraphActions.Push.prototype.icon = 'octicon octicon-cloud-upload';
GraphActions.Push.prototype.createHoverGraphic = function() {
  var context = this.graph.currentActionContext();
  if (!context) return null;
  var remoteRef = context.getRemoteRef(this.graph.currentRemote());
  if (!remoteRef) return null;
  return new PushViewModel(remoteRef.node(), context.node());
}
GraphActions.Push.prototype.perform = function() {
  var ref = this.graph.currentActionContext();
  var remoteRef = ref.getRemoteRef(this.graph.currentRemote());

  if (remoteRef) {
    return remoteRef.moveTo(ref.node().sha1);
  } else {
    return ref.createRemoteRef()
      .then(() => {
        if (this.graph.HEAD().name == ref.name) {
          this.grah.HEADref().node(ref.node());
        }
      }).finally(() => programEvents.dispatch({ event: 'request-fetch-tags' }));
  }
}

GraphActions.Checkout = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    if (self.graph.currentActionContext() instanceof RefViewModel)
      return self.graph.currentActionContext().node() == self.node &&
        !self.graph.currentActionContext().current();
    return ungit.config.allowCheckoutNodes &&
      self.graph.currentActionContext() == self.node;
  });
}
inherits(GraphActions.Checkout, GraphActions.ActionBase);
GraphActions.Checkout.prototype.text = 'Checkout';
GraphActions.Checkout.prototype.style = 'checkout';
GraphActions.Checkout.prototype.icon = 'octicon octicon-desktop-download';
GraphActions.Checkout.prototype.perform = function() {
  return this.graph.currentActionContext().checkout();
}

GraphActions.Delete = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    return self.graph.currentActionContext() instanceof RefViewModel &&
      self.graph.currentActionContext().node() == self.node &&
      !self.graph.currentActionContext().current();
  });
}
inherits(GraphActions.Delete, GraphActions.ActionBase);
GraphActions.Delete.prototype.text = 'Delete';
GraphActions.Delete.prototype.style = 'delete';
GraphActions.Delete.prototype.icon = 'glyphicon glyphicon-remove';
GraphActions.Delete.prototype.perform = function() {
  const context = this.graph.currentActionContext();
  let details = `"${context.refName}"`;
  if (context.isRemoteBranch) {
    details = `<code style='font-size: 100%'>REMOTE</code> ${details}`;
  }
  details = `Deleting ${details} branch or tag cannot be undone with ungit.`;

  return components.create('yesnodialog', { title: 'Are you sure?', details: details })
    .show()
    .closeThen((diag) => {
      if (diag.result()) return context.remove();
    }).closePromise;
}

GraphActions.CherryPick = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    var context = self.graph.currentActionContext();
    return context === self.node && self.graph.HEAD() && context.sha1 !== self.graph.HEAD().sha1
  });
}
inherits(GraphActions.CherryPick, GraphActions.ActionBase);
GraphActions.CherryPick.prototype.text = 'Cherry pick';
GraphActions.CherryPick.prototype.style = 'cherry-pick';
GraphActions.CherryPick.prototype.icon = 'octicon octicon-circuit-board';
GraphActions.CherryPick.prototype.perform = function() {
  var self = this;
  return this.server.postPromise('/cherrypick', { path: this.graph.repoPath(), name: this.node.sha1 })
    .catch(function(err) { if (err.errorCode != 'merge-failed') self.server.unhandledRejection(err); })
}

GraphActions.Uncommit = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    return self.graph.currentActionContext() == self.node &&
      self.graph.HEAD() == self.node;
  });
}
inherits(GraphActions.Uncommit, GraphActions.ActionBase);
GraphActions.Uncommit.prototype.text = 'Uncommit';
GraphActions.Uncommit.prototype.style = 'uncommit';
GraphActions.Uncommit.prototype.icon = 'octicon octicon-zap';
GraphActions.Uncommit.prototype.perform = function() {
  var self = this;
  return this.server.postPromise('/reset', { path: this.graph.repoPath(), to: 'HEAD^', mode: 'mixed' })
    .then(function() {
      var targetNode = self.node.belowNode;
      while (targetNode && !targetNode.ancestorOfHEAD()) {
        targetNode = targetNode.belowNode;
      }
      self.graph.HEADref().node(targetNode ? targetNode : null);
      self.graph.checkedOutRef().node(targetNode ? targetNode : null);
    });
}

GraphActions.Revert = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    return self.graph.currentActionContext() == self.node;
  });
}
inherits(GraphActions.Revert, GraphActions.ActionBase);
GraphActions.Revert.prototype.text = 'Revert';
GraphActions.Revert.prototype.style = 'revert';
GraphActions.Revert.prototype.icon = 'octicon octicon-history';
GraphActions.Revert.prototype.perform = function() {
  var self = this;
  return this.server.postPromise('/revert', { path: this.graph.repoPath(), commit: this.node.sha1 });
}

GraphActions.Squash = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.isRunning()) return true;
    return self.graph.currentActionContext() instanceof RefViewModel &&
      self.graph.currentActionContext().current() &&
      self.graph.currentActionContext().node() != self.node;
  });
}
inherits(GraphActions.Squash, GraphActions.ActionBase);
GraphActions.Squash.prototype.text = 'Squash';
GraphActions.Squash.prototype.style = 'squash';
GraphActions.Squash.prototype.icon = 'octicon octicon-fold';
GraphActions.Squash.prototype.createHoverGraphic = function() {
  let onto = this.graph.currentActionContext();
  if (!onto) return;
  if (onto instanceof RefViewModel) onto = onto.node();

  return new SquashViewModel(this.node, onto);
}
GraphActions.Squash.prototype.perform = function() {
  let onto = this.graph.currentActionContext();
  if (!onto) return;
  if (onto instanceof RefViewModel) onto = onto.node();
  // remove last element as it would be a common ancestor.
  const path = this.node.getPathToCommonAncestor(onto).slice(0, -1);

  if (path.length > 0) {
    // squashing branched out lineage
    // c is checkout with squash target of e, results in staging changes
    // from d and e on top of c
    //
    // a - b - (c)        a - b - (c) - [de]
    //  \           ->     \
    //   d  - <e>           d - <e>
    return this.server.postPromise('/squash', { path: this.graph.repoPath(), target: this.node.sha1 });
  } else {
    // squashing backward from same lineage
    // c is checkout with squash target of a, results in current ref moved
    // to a and staging changes within b and c on top of a
    //
    // <a> - b - (c)       (a) - b - c
    //                ->     \
    //                        [bc]
    return this.graph.currentActionContext().moveTo(this.node.sha1, true)
      .then(() => this.server.postPromise('/squash', { path: this.graph.repoPath(), target: onto.sha1 }))
  }
}
