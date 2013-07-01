
if (typeof exports !== 'undefined') {
	ko = require('./lib/knockout-2.2.1.js');
	inherits = require('./utils').inherits;
}

var GraphActions = {};
if (typeof module !== 'undefined') module.exports = GraphActions;

GraphActions.ActionBase = function(graph) {
	this.graph = graph;
	this.dragObject = ko.observable();
	this.performProgressBar = new ProgressBarViewModel('action-' + this.visualization + '-' + graph.repoPath, 1000);
}
GraphActions.ActionBase.prototype.doPerform = function(ref) {
	var self = this;
	this.graph.hoverGraphAction(null);
	self.performProgressBar.start();
	this.perform(ref, function() {
		self.performProgressBar.stop();
	});
}
GraphActions.ActionBase.prototype.dragEnter = function(dragObject) {
	if (!this.visible()) return;
	this.graph.hoverGraphAction(this);
	this.dragObject(dragObject);
}
GraphActions.ActionBase.prototype.dragLeave = function() {
	if (!this.visible()) return;
	this.graph.hoverGraphAction(null);
	this.dragObject(null);
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
		return self.graph.showDropTargets() && self.graph.draggingRef().node() != self.node;
	});
	this.style = ko.computed(function() { return 'move ' + (self.visible() ? 'show' : ''); });
}
inherits(GraphActions.Move, GraphActions.ActionBase);
GraphActions.Move.prototype.text = 'Move';
GraphActions.Move.prototype.visualization = 'move';
GraphActions.Move.prototype.perform = function(ref, callback) {
	if (ref.current())
		api.query('POST', '/reset', { path: this.graph.repoPath, to: this.node.sha1 }, callback);
	else if (ref.isTag)
		api.query('POST', '/tags', { path: this.graph.repoPath, name: ref.displayName, startPoint: this.node.sha1, force: true }, callback);
	else
		api.query('POST', '/branches', { path: this.graph.repoPath, name: ref.displayName, startPoint: this.node.sha1, force: true }, callback);
}

GraphActions.Reset = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.ref = this.dragObject;
	this.onto = ko.observable(this.node);
	this.visible = ko.computed(function() {
		if (self.performProgressBar.running()) return true;
		return self.graph.showDropTargets() && 
			self.graph.draggingRef().node() == self.node &&
			self.graph.draggingRef().remoteRef() &&
			self.graph.draggingRef().remoteRef().node() != self.graph.draggingRef().node() &&
			!self.graph.draggingRef().remoteIsOffspring();;
	});
	this.style = ko.computed(function() { return 'reset ' + (self.visible() ? 'show' : ''); });
}
inherits(GraphActions.Reset, GraphActions.ActionBase);
GraphActions.Reset.prototype.text = 'Reset';
GraphActions.Reset.prototype.visualization = 'reset';
GraphActions.Reset.prototype.perform = function(ref, callback) {
	api.query('POST', '/reset', { path: this.graph.repoPath, to: ref.remoteRef().name }, callback);
}


GraphActions.Pull = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.ref = this.dragObject;
	this.onto = ko.observable(this.node);
	this.visible = ko.computed(function() {
		if (self.performProgressBar.running()) return true;
		return self.graph.showDropTargets() && 
			self.graph.draggingRef().node() == self.node &&
			self.graph.draggingRef().remoteRef() &&
			self.graph.draggingRef().remoteRef().node() != self.graph.draggingRef().node() &&
			self.graph.draggingRef().remoteIsOffspring();;
	});
	this.style = ko.computed(function() { return 'pull ' + (self.visible() ? 'show' : ''); });
}
inherits(GraphActions.Pull, GraphActions.ActionBase);
GraphActions.Pull.prototype.text = 'Pull';
GraphActions.Pull.prototype.visualization = 'pull';
GraphActions.Pull.prototype.perform = function(ref, callback) {
	api.query('POST', '/reset', { path: this.graph.repoPath, to: ref.remoteRef().name }, callback);
}

GraphActions.Rebase = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.ref = this.dragObject;
	this.onto = ko.observable(this.node);
	this.visible = ko.computed(function() {
		return self.graph.showDropTargets() && 
			(!ungit.config.showRebaseAndMergeOnlyOnRefs || self.node.refs().length > 0) &&
			!self.node.isAncestor(self.graph.draggingRef().node()) &&
			!self.graph.draggingRef().node().isAncestor(self.node) &&
			self.graph.draggingRef().current();
	});
	this.style = ko.computed(function() { return 'rebase ' + (self.visible() ? 'show' : ''); });
}
inherits(GraphActions.Rebase, GraphActions.ActionBase);
GraphActions.Rebase.prototype.text = 'Rebase';
GraphActions.Rebase.prototype.visualization = 'rebase';
GraphActions.Rebase.prototype.perform = function(ref, callback) {
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

GraphActions.Merge = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.visible = ko.computed(function() {
		return self.graph.showDropTargets() &&
			(!ungit.config.showRebaseAndMergeOnlyOnRefs || self.node.refs().length > 0) &&
			!self.node.isAncestor(self.graph.draggingRef().node()) &&
			!self.graph.draggingRef().node().isAncestor(self.node) &&
			self.graph.draggingRef().current();
	});
	this.style = ko.computed(function() { return 'merge ' + (self.visible() ? 'show' : ''); });
}
inherits(GraphActions.Merge, GraphActions.ActionBase);
GraphActions.Merge.prototype.text = 'Merge';
GraphActions.Merge.prototype.visualization = 'merge';
GraphActions.Merge.prototype.perform = function(ref, callback) {
	api.query('POST', '/merge', { path: this.graph.repoPath, with: this.node.sha1 }, callback);
}

GraphActions.Push = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.ref = this.dragObject;
	this.visible = ko.computed(function() {
		if (self.performProgressBar.running()) return true;
		return self.graph.showDropTargets() && 
			self.graph.draggingRef().node() == self.node &&
			self.graph.draggingRef().canBePushed();
	});
	this.style = ko.computed(function() { return 'push ' + (self.visible() ? 'show' : ''); });
}
inherits(GraphActions.Push, GraphActions.ActionBase);
GraphActions.Push.prototype.text = 'Push';
GraphActions.Push.prototype.visualization = 'push';
GraphActions.Push.prototype.perform = function(ref, callback) {
	var self = this;
	var programEventListener = function(event) {
		if (event.event == 'credentialsRequested') self.performProgressBar.pause();
		else if (event.event == 'credentialsProvided') self.performProgressBar.unpause();
	};
	this.graph.repository.main.programEvents.add(programEventListener);
	api.query('POST', '/push', { path: this.graph.repoPath, socketId: api.socketId, localBranch: ref.displayName, remoteBranch: ref.displayName }, function(err, res) {
		self.graph.repository.main.programEvents.remove(programEventListener);
		self.graph.loadNodesFromApi();
		callback();
	});
}

GraphActions.Checkout = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.ref = this.dragObject;
	this.visible = ko.computed(function() {
		if (self.performProgressBar.running()) return true;
		return self.graph.showDropTargets() && 
			self.graph.draggingRef().node() == self.node &&
			!self.graph.draggingRef().current();
	});
	this.style = ko.computed(function() { return 'checkout ' + (self.visible() ? 'show' : ''); });
}
inherits(GraphActions.Checkout, GraphActions.ActionBase);
GraphActions.Checkout.prototype.text = 'Checkout';
GraphActions.Checkout.prototype.visualization = 'checkout';
GraphActions.Checkout.prototype.perform = function(ref, callback) {
	api.query('POST', '/checkout', { path: this.graph.repoPath, name: ref.displayName }, callback);
}

GraphActions.Delete = function(graph, node) {
	var self = this;
	GraphActions.ActionBase.call(this, graph);
	this.node = node;
	this.ref = this.dragObject;
	this.visible = ko.computed(function() {
		return self.graph.showDropTargets() && 
			self.graph.draggingRef().node() == self.node &&
			!self.graph.draggingRef().current();
	});
	this.style = ko.computed(function() { return 'delete ' + (self.visible() ? 'show' : ''); });
}
inherits(GraphActions.Delete, GraphActions.ActionBase);
GraphActions.Delete.prototype.text = 'Delete';
GraphActions.Delete.prototype.visualization = 'delete';
GraphActions.Delete.prototype.perform = function(ref, callback) {
	var self = this;
	var url = ref.isTag ? '/tags' : '/branches';
	api.query('DELETE', url, { path: this.graph.repoPath, name: ref.displayName, remote: ref.isRemote }, function(err) {
		callback();
		self.graph.loadNodesFromApi();
	});
}

