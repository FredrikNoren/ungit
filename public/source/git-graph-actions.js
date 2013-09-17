
var ko = require('../vendor/js/knockout-2.2.1.js');
var inherits = require('util').inherits;
var ProgressBarViewModel = require('./controls').ProgressBarViewModel;
var NodeViewModel = require('./node').NodeViewModel;
var RefViewModel = require('./ref.js').RefViewModel;
var EdgeViewModel = require('./edge').EdgeViewModel;
var Vector2 = require('./vector2');
var _ = require('underscore');

var GraphActions = {};
module.exports = GraphActions;

GraphActions.ActionBase = function(graph) {
	this.graph = graph;
	this.performProgressBar = new ProgressBarViewModel('action-' + this.style + '-' + graph.repoPath, 1000);
}
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
		return self.graph.showDropTargets() && self.graph.currentActionContext().node() != self.node;
	});
}
inherits(GraphActions.Move, GraphActions.ActionBase);
GraphActions.Move.prototype.text = 'Move';
GraphActions.Move.prototype.style = 'move';
GraphActions.Move.prototype.perform = function(callback) {
	if (this.graph.currentActionContext().current())
		api.query('POST', '/reset', { path: this.graph.repoPath, to: this.node.sha1 }, callback);
	else if (this.graph.currentActionContext().isTag)
		api.query('POST', '/tags', { path: this.graph.repoPath, name: this.graph.currentActionContext().displayName, startPoint: this.node.sha1, force: true }, callback);
	else
		api.query('POST', '/branches', { path: this.graph.repoPath, name: this.graph.currentActionContext().displayName, startPoint: this.node.sha1, force: true }, callback);
}


GraphActions.Reset = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.onto = ko.observable(this.node);
	this.visible = ko.computed(function() {
		if (self.performProgressBar.running()) return true;
		return self.graph.showDropTargets() && 
			self.graph.currentActionContext().node() == self.node &&
			self.graph.currentActionContext().remoteRef() &&
			self.graph.currentActionContext().remoteRef().node() != self.graph.currentActionContext().node() &&
			!self.graph.currentActionContext().remoteIsOffspring();;
	});
}
inherits(GraphActions.Reset, GraphActions.ActionBase);
GraphActions.Reset.prototype.text = 'Reset';
GraphActions.Reset.prototype.style = 'reset';
GraphActions.Reset.prototype.perform = function(callback) {
	api.query('POST', '/reset', { path: this.graph.repoPath, to: this.graph.currentActionContext().remoteRef().name }, callback);
}


GraphActions.Pull = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.onto = ko.observable(this.node);
	this.visible = ko.computed(function() {
		if (self.performProgressBar.running()) return true;
		return self.graph.showDropTargets() && 
			self.graph.currentActionContext().node() == self.node &&
			self.graph.currentActionContext().remoteRef() &&
			self.graph.currentActionContext().remoteRef().node() != self.graph.currentActionContext().node() &&
			self.graph.currentActionContext().remoteIsOffspring();;
	});
}
inherits(GraphActions.Pull, GraphActions.ActionBase);
GraphActions.Pull.prototype.text = 'Pull';
GraphActions.Pull.prototype.style = 'pull';
GraphActions.Pull.prototype.perform = function(callback) {
	api.query('POST', '/reset', { path: this.graph.repoPath, to: this.graph.currentActionContext().remoteRef().name }, callback);
}


GraphActions.Rebase = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.visible = ko.computed(function() {
		if (self.performProgressBar.running()) return true;
		return self.graph.showDropTargets() && 
			(!ungit.config.showRebaseAndMergeOnlyOnRefs || self.node.refs().length > 0) &&
			!self.node.isAncestor(self.graph.currentActionContext().node()) &&
			!self.graph.currentActionContext().node().isAncestor(self.node) &&
			self.graph.currentActionContext().current();
	});
}
inherits(GraphActions.Rebase, GraphActions.ActionBase);
GraphActions.Rebase.prototype.text = 'Rebase';
GraphActions.Rebase.prototype.style = 'rebase';
GraphActions.Rebase.prototype.createHoverGraphic = function() {
	return new RebaseHoverGraphic(this.graph.currentActionContext(), this.node);
}
GraphActions.Rebase.prototype.perform = function(callback) {
	api.query('POST', '/rebase', { path: this.graph.repoPath, onto: this.node.sha1 }, function(err) {
		if (err) {
			if (err.errorCode = 'merge-failed') {
				callback();
				return true;
			}
			return;
		}
		callback();
	});
}
var RebaseHoverGraphic = function(ref, onto) {
	var self = this;
	if (onto instanceof RefViewModel) onto = onto.node();
	
	var rebaseNodes = {};
	this.path = ref.node().getPathToCommonAncestor(onto);
	this.path.slice(0, -1).forEach(function(node) { rebaseNodes[node.sha1] = true; });

	this.nodes = this.path.slice(0, -1).map(function(node) {
		var n = new NodeViewModel(node.position(), node.radius());
		n.setPosition(new Vector2(
				onto.x() + (node.x() - _.last(self.path).x()),
				onto.y() + (node.y() - _.last(self.path).y())));
		n.animationSpeed = 2;
		return n;
	});

	this.edges = [];
	var prevNode = onto;
	this.nodes.reverse().forEach(function(node) {
		self.edges.push(new EdgeViewModel(node, prevNode));
		prevNode = node;
	});

	this.path.slice(0, -1).forEach(function(node) {
		node.overrideColor('#bbbbbb');
	});
}
RebaseHoverGraphic.prototype.type = 'rebase';
RebaseHoverGraphic.prototype.destroy = function() {
	this.path.forEach(function(node) {
		node.overrideColor(null);
	});
}
RebaseHoverGraphic.prototype.updateAnimationFrame = function(deltaT) {
	this.nodes.forEach(function(node) {
		node.updateAnimationFrame(deltaT);
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
		return self.graph.showDropTargets() &&
			!self.graph.currentActionContext().current() &&
			self.graph.checkedOutRef().node() == self.node &&
			!self.node.isAncestor(self.graph.currentActionContext().node());
	});
}
inherits(GraphActions.Merge, GraphActions.ActionBase);
GraphActions.Merge.prototype.text = 'Merge';
GraphActions.Merge.prototype.style = 'merge';
GraphActions.Merge.prototype.perform = function(callback) {
	api.query('POST', '/merge', { path: this.graph.repoPath, with: this.graph.currentActionContext().displayName }, function(err) {
		if (err) {
			if (err.errorCode = 'merge-failed') {
				callback();
				return true;
			}
			return;
		}
		callback();
	});
}

GraphActions.Push = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.visible = ko.computed(function() {
		if (self.performProgressBar.running()) return true;
		return self.graph.showDropTargets() && 
			self.graph.currentActionContext().node() == self.node &&
			self.graph.currentActionContext().canBePushed();
	});
}
inherits(GraphActions.Push, GraphActions.ActionBase);
GraphActions.Push.prototype.text = 'Push';
GraphActions.Push.prototype.style = 'push';
GraphActions.Push.prototype.perform = function( callback) {
	var self = this;
	var programEventListener = function(event) {
		if (event.event == 'credentialsRequested') self.performProgressBar.pause();
		else if (event.event == 'credentialsProvided') self.performProgressBar.unpause();
	};
	this.graph.repository.main.programEvents.add(programEventListener);
	api.query('POST', '/push', { path: this.graph.repoPath, socketId: api.socketId, 
			localBranch: this.graph.currentActionContext().displayName, remoteBranch: this.graph.currentActionContext().displayName }, function(err, res) {
		self.graph.repository.main.programEvents.remove(programEventListener);
		if (err) {
			if (err.errorCode == 'non-fast-forward') {
				self.graph.repository.remoteErrorPopup('Couldn\'t push, things have changed on the server. Fetching new nodes.');
				self.graph.repository.fetch({ nodes: true, tags: true }, function() {
					setTimeout(function() {
						self.graph.repository.closeRemoteErrorPopup();
					}, 5000);
				});
				callback();
				return true;
			} else {
				return;
			}
		}
		self.graph.loadNodesFromApi();
		self.graph.repository.fetch({ tags: true });
		callback();
	});
}

GraphActions.Checkout = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.visible = ko.computed(function() {
		if (self.performProgressBar.running()) return true;
		return self.graph.showDropTargets() && 
			self.graph.currentActionContext().node() == self.node &&
			!self.graph.currentActionContext().current();
	});
}
inherits(GraphActions.Checkout, GraphActions.ActionBase);
GraphActions.Checkout.prototype.text = 'Checkout';
GraphActions.Checkout.prototype.style = 'checkout';
GraphActions.Checkout.prototype.perform = function(callback) {
	var self = this;
	var ref = this.graph.currentActionContext();
	api.query('POST', '/checkout', { path: this.graph.repoPath, name: ref.displayName }, function(err) {
		if (err && err.errorCode != 'merge-failed') return;
		if (ref.isRemoteBranch)
			api.query('POST', '/reset', { path: self.graph.repoPath, to: ref.name }, function(err, res) {
				if (err && err.errorCode != 'merge-failed') return;
				callback();
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
		return self.graph.showDropTargets() && 
			self.graph.currentActionContext().node() == self.node &&
			!self.graph.currentActionContext().current();
	});
}
inherits(GraphActions.Delete, GraphActions.ActionBase);
GraphActions.Delete.prototype.text = 'Delete';
GraphActions.Delete.prototype.style = 'delete';
GraphActions.Delete.prototype.perform = function(callback) {
	var self = this;
	var url = this.graph.currentActionContext().isTag ? '/tags' : '/branches';
	api.query('DELETE', url, { path: this.graph.repoPath, name: this.graph.currentActionContext().displayName, remote: this.graph.currentActionContext().isRemote, socketId: api.socketId }, function(err) {
		callback();
		self.graph.loadNodesFromApi();
		self.graph.repository.fetch({ tags: true });
	});
}

