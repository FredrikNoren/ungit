
var ko = require('knockout');
var inherits = require('util').inherits;
var components = require('ungit-components');
var RefViewModel = require('./ref.js').RefViewModel;
var graphGraphicsActions = require('./graph-graphics/actions');
var RebaseViewModel = graphGraphicsActions.RebaseViewModel;
var MergeViewModel = graphGraphicsActions.MergeViewModel;
var ResetViewModel = graphGraphicsActions.ResetViewModel;
var PushViewModel = graphGraphicsActions.PushViewModel;
var programEvents = require('ungit-program-events');

var GraphActions = {};
module.exports = GraphActions;

GraphActions.ActionBase = function(graph) {
  var self = this;
  this.graph = graph;
  this.server = graph.server;
  this.performProgressBar = components.create('progressBar', {
    predictionMemoryKey: 'action-' + this.style + '-' + graph.repoPath,
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
GraphActions.Move.prototype.icon = 'glyphicon-move';
GraphActions.Move.prototype.perform = function(callback) {
  this.graph.currentActionContext().moveTo(this.node.sha1, callback);
}


GraphActions.Reset = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.onto = ko.observable(this.node);
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
    if (!(self.graph.currentActionContext() instanceof RefViewModel)) return false;
    var context = self.graph.currentActionContext();
    if (context.node() != self.node) return false;
    var remoteRef = context.getRemoteRef(self.graph.currentRemote());
    return remoteRef &&
      remoteRef.node() != context.node() &&
      remoteRef.node().commitTime().unix() < context.node().commitTime().unix();
  });
}
inherits(GraphActions.Reset, GraphActions.ActionBase);
GraphActions.Reset.prototype.text = 'Reset';
GraphActions.Reset.prototype.style = 'reset';
GraphActions.Reset.prototype.icon = 'glyphicon-trash';
GraphActions.Reset.prototype.createHoverGraphic = function() {
  var context = this.graph.currentActionContext();
  if (!context) return null;
  var remoteRef = context.getRemoteRef(this.graph.currentRemote());
  var nodes = context.node().getPathToCommonAncestor(remoteRef.node()).slice(0, -1);
  return new ResetViewModel(nodes);
}
GraphActions.Reset.prototype.perform = function(callback) {
  var remoteRef = this.graph.currentActionContext().getRemoteRef(this.graph.currentRemote());
  this.server.post('/reset', { path: this.graph.repoPath, to: remoteRef.name, mode: 'hard' }, callback);
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
GraphActions.Rebase.prototype.createHoverGraphic = function() {
  var onto = this.graph.currentActionContext();
  if (!onto) return;
  if (onto instanceof RefViewModel) onto = onto.node();
  var path = onto.getPathToCommonAncestor(this.node);
  return new RebaseViewModel(this.node, path);
}
GraphActions.Rebase.prototype.perform = function(callback) {
  this.server.post('/rebase', { path: this.graph.repoPath, onto: this.node.sha1 }, function(err) {
    callback();
    if (err && err.errorCode == 'merge-failed') return true;
  });
}


GraphActions.Merge = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.mergeWith = ko.observable(this.node);
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
GraphActions.Merge.prototype.createHoverGraphic = function() {
  var node = this.graph.currentActionContext();
  if (!node) return null;
  if (node instanceof RefViewModel) node = node.node();
  return new MergeViewModel(this.graph.graphic, this.node, node);
}
GraphActions.Merge.prototype.perform = function(callback) {
  this.server.post('/merge', { path: this.graph.repoPath, with: this.graph.currentActionContext().localRefName }, function(err) {
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
GraphActions.Push.prototype.icon = 'glyphicon-open';
GraphActions.Push.prototype.createHoverGraphic = function() {
  var context = this.graph.currentActionContext();
  if (!context) return null;
  var remoteRef = context.getRemoteRef(this.graph.currentRemote());
  if (!remoteRef) return null;
  return new PushViewModel(remoteRef.node(), context.node());
}
GraphActions.Push.prototype.perform = function( callback) {
  var self = this;
  var programEventListener = function(event) {
    if (event.event == 'request-credentials') self.performProgressBar.pause();
    else if (event.event == 'request-credentials-response') self.performProgressBar.unpause();
  };
  programEvents.add(programEventListener);
  var ref = this.graph.currentActionContext();
  var onDone = function(err) {
    programEvents.remove(programEventListener);
    callback();
    if (!err) {
      self.graph.loadNodesFromApi();
      if (ref.isTag) {
        programEvents.dispatch({ event: 'request-fetch-tags' });
      }
    }
  }
  var remoteRef = ref.getRemoteRef(this.graph.currentRemote());
  if (remoteRef) remoteRef.moveTo(ref.refName, onDone);
  else ref.createRemoteRef(onDone);
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
GraphActions.Checkout.prototype.icon = 'glyphicon-folder-open';
GraphActions.Checkout.prototype.perform = function(callback) {
  var self = this;
  var context = this.graph.currentActionContext();
  var refName;
  if (context instanceof RefViewModel) refName = context.refName;
  else refName = context.sha1;
  this.server.post('/checkout', { path: this.graph.repoPath, name: refName }, function(err) {
    if (err && err.errorCode != 'merge-failed') {
      callback();
      return;
    }
    if (context instanceof RefViewModel && context.isRemoteBranch)
      self.server.post('/reset', { path: self.graph.repoPath, to: context.name, mode: 'hard' }, function(err, res) {
        callback();
        if (err && err.errorCode != 'merge-failed') return;
        return true;
      });
    else
      callback();
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
GraphActions.Delete.prototype.icon = 'glyphicon-remove';
GraphActions.Delete.prototype.perform = function(callback) {
  this.graph.currentActionContext().remove(callback);
}


GraphActions.CherryPick = function(graph, node) {
  var self = this;
  GraphActions.ActionBase.call(this, graph);
  this.node = node;
  this.visible = ko.computed(function() {
    if (self.performProgressBar.running()) return true;
    return self.graph.currentActionContext() == self.node
  });
}
inherits(GraphActions.CherryPick, GraphActions.ActionBase);
GraphActions.CherryPick.prototype.text = 'Cherry pick';
GraphActions.CherryPick.prototype.style = 'cherry-pick';
GraphActions.CherryPick.prototype.perform = function(callback) {
  var self = this;
  this.server.post('/cherrypick', { path: this.graph.repoPath, name: this.node.sha1 }, function(err) {
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
GraphActions.Uncommit.prototype.perform = function(callback) {
  var self = this;
  this.server.post('/reset', { path: this.graph.repoPath, to: 'HEAD^', mode: 'mixed' }, callback);
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
GraphActions.Revert.prototype.perform = function(callback) {
  var self = this;
  this.server.post('/revert', { path: this.graph.repoPath, commit: this.node.sha1 }, callback);
}
