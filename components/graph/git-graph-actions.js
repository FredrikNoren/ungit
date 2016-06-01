
var ko = require('knockout');
var inherits = require('util').inherits;
var components = require('ungit-components');
var RefViewModel = require('./git-ref.js');
var HoverActions = require('./hover-actions');
var RebaseViewModel = HoverActions.RebaseViewModel;
var MergeViewModel = HoverActions.MergeViewModel;
var ResetViewModel = HoverActions.ResetViewModel;
var PushViewModel = HoverActions.PushViewModel;
var programEvents = require('ungit-program-events');

var GraphActions = {};
module.exports = GraphActions;

GraphActions.ActionBase = function(graph) {
  var self = this;
  this.graph = graph;
  this.server = graph.server;
  this.performProgressBar = components.create('progressBar', {
    predictionMemoryKey: 'action-' + this.style + '-' + graph.repoPath(),
    fallbackPredictedTimeMs: 1000,
    temporary: true
  });

  this.isHighlighted = ko.computed(function() {
    return !graph.hoverGraphAction() || graph.hoverGraphAction() == self;
  });
  this.cssClasses = ko.computed(function() {
    var c = self.style;
    if (!self.isHighlighted()) c += ' dimmed';
    return c;
  })
}
GraphActions.ActionBase.prototype.icon = null;
GraphActions.ActionBase.prototype.doPerform = function() {
  var self = this;
  this.graph.hoverGraphAction(null);
  self.performProgressBar.start();
  this.perform(function() {
    self.performProgressBar.stop();
  });
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
    if (self.performProgressBar.running()) return true;
    return self.graph.currentActionContext() instanceof RefViewModel &&
      self.graph.currentActionContext().node() != self.node;
  });
}
inherits(GraphActions.Move, GraphActions.ActionBase);
GraphActions.Move.prototype.text = 'Move';
GraphActions.Move.prototype.style = 'move';
GraphActions.Move.prototype.icon = 'glyphicon glyphicon-move';
GraphActions.Move.prototype.perform = function(callback) {
  this.graph.currentActionContext().moveTo(this.node.sha1, callback);
}

GraphActions.Reset = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
    if (!(self.graph.currentActionContext() instanceof RefViewModel)) return false;
    var context = self.graph.currentActionContext();
    if (context.node() != self.node) return false;
    var remoteRef = context.getRemoteRef(self.graph.currentRemote());
    return remoteRef &&
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
GraphActions.Reset.prototype.perform = function(callback) {
  var self = this;
  var context = this.graph.currentActionContext();
  var remoteRef = context.getRemoteRef(self.graph.currentRemote());
  var diag = components.create('yesnodialog', { title: 'Are you sure?', details: 'Resetting to ref: ' + remoteRef.name + ' cannot be undone with ungit.'});
  diag.closed.add(function() {
    if (diag.result()) {
      self.server.post('/reset', { path: self.graph.repoPath(), to: remoteRef.name, mode: 'hard' }, function() {
        context.node(remoteRef.node());
        callback();
      });
    } else {
      callback();
    }
  });
  programEvents.dispatch({ event: 'request-show-dialog', dialog: diag });
}

GraphActions.Rebase = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
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
GraphActions.Rebase.prototype.perform = function(callback) {
  this.server.post('/rebase', { path: this.graph.repoPath(), onto: this.node.sha1 }, function(err) {
    callback();
    if (err && err.errorCode == 'merge-failed') return true;
  });
}

GraphActions.Merge = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
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
GraphActions.Merge.prototype.perform = function(callback) {
  this.server.post('/merge', { path: this.graph.repoPath(), with: this.graph.currentActionContext().localRefName }, function(err) {
    callback();
    if (err && err.errorCode == 'merge-failed') return true;
  });
}

GraphActions.Push = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
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
GraphActions.Push.prototype.perform = function(callback) {
  var self = this;
  var ref = this.graph.currentActionContext();
  var remoteRef = ref.getRemoteRef(this.graph.currentRemote());

  if (remoteRef) {
    remoteRef.moveTo(ref.node().sha1, callback);
  } else ref.createRemoteRef(function(err) {
    if (!err && self.graph.HEAD().name == ref.name) {
      self.grah.HEADref().node(ref.node());
    }
    callback();
  });
}

GraphActions.Checkout = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
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
GraphActions.Checkout.prototype.perform = function(callback) {
  var self = this;
  var context = this.graph.currentActionContext();
  var refName = context instanceof RefViewModel ? context.refName : context.sha1;
  this.server.post('/checkout', { path: this.graph.repoPath(), name: refName }, function(err) {
    if (err && err.errorCode != 'merge-failed') {
      callback();
      return;
    }

    if (context instanceof RefViewModel && context.isRemoteBranch) {
      self.server.post('/reset', { path: self.graph.repoPath(), to: context.name, mode: 'hard' }, function(err, res) {
        self.graph.HEADref().node(context instanceof RefViewModel ? context.node() : context);
        callback();
        return err && err.errorCode != 'merge-failed' ? undefined : true;
      });
    } else {
      self.graph.HEADref().node(context instanceof RefViewModel ? context.node() : context);
      callback();
    }
    return true;
  });
}

GraphActions.Delete = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
    return self.graph.currentActionContext() instanceof RefViewModel &&
      self.graph.currentActionContext().node() == self.node &&
      !self.graph.currentActionContext().current();
  });
}
inherits(GraphActions.Delete, GraphActions.ActionBase);
GraphActions.Delete.prototype.text = 'Delete';
GraphActions.Delete.prototype.style = 'delete';
GraphActions.Delete.prototype.icon = 'glyphicon glyphicon-remove';
GraphActions.Delete.prototype.perform = function(callback) {
  var context = this.graph.currentActionContext();
  var name = context.isRemoteBranch ? "remote " + context.localRefName : context.localRefName;
  var diag = components.create('yesnodialog', { title: 'Are you sure?', details: 'Deleting ' + name + ' branch or tag cannot be undone with ungit.'});
  diag.closed.add(function() {
    if (diag.result()) {
      context.remove(callback);
    } else {
      callback();
    }
  });
  programEvents.dispatch({ event: 'request-show-dialog', dialog: diag });
}

GraphActions.CherryPick = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
    var context = self.graph.currentActionContext();
    return context === self.node && self.graph.HEAD() && context.sha1 !== self.graph.HEAD().sha1
  });
}
inherits(GraphActions.CherryPick, GraphActions.ActionBase);
GraphActions.CherryPick.prototype.text = 'Cherry pick';
GraphActions.CherryPick.prototype.style = 'cherry-pick';
GraphActions.CherryPick.prototype.icon = 'octicon octicon-circuit-board';
GraphActions.CherryPick.prototype.perform = function(callback) {
  var self = this;
  this.server.post('/cherrypick', { path: this.graph.repoPath(), name: this.node.sha1 }, function(err) {
    callback();
    if (err && err.errorCode == 'merge-failed') return true;
  });
}

GraphActions.Uncommit = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
    return self.graph.currentActionContext() == self.node &&
      self.graph.HEAD() == self.node;
  });
}
inherits(GraphActions.Uncommit, GraphActions.ActionBase);
GraphActions.Uncommit.prototype.text = 'Uncommit';
GraphActions.Uncommit.prototype.style = 'uncommit';
GraphActions.Uncommit.prototype.icon = 'octicon octicon-zap';
GraphActions.Uncommit.prototype.perform = function(callback) {
  var self = this;
  this.server.postPromise('/reset', { path: this.graph.repoPath(), to: 'HEAD^', mode: 'mixed' })
    .then(function() {
      var targetNode = self.node.belowNode;
      while (targetNode && !targetNode.ancestorOfHEAD()) {
        targetNode = targetNode.belowNode;
      }
      self.graph.HEADref().node(targetNode ? targetNode : null);
      self.graph.checkedOutRef().node(targetNode ? targetNode : null);
    }).finally(callback);
}

GraphActions.Revert = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
    return self.graph.currentActionContext() == self.node;
  });
}
inherits(GraphActions.Revert, GraphActions.ActionBase);
GraphActions.Revert.prototype.text = 'Revert';
GraphActions.Revert.prototype.style = 'revert';
GraphActions.Revert.prototype.icon = 'octicon octicon-history';
GraphActions.Revert.prototype.perform = function(callback) {
  var self = this;
  this.server.postPromise('/revert', { path: this.graph.repoPath(), commit: this.node.sha1 })
    .finally(callback);
}
