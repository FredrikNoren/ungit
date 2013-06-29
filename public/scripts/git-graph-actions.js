
if (typeof exports !== 'undefined') {
	ko = require('./lib/knockout-2.2.1.js');
	inherits = require('./utils').inherits;
}

var GraphActions = {};
if (typeof module !== 'undefined') module.exports = GraphActions;

GraphActions.DropareaBase = function(graph) {
	this.graph = graph;
	this.dragObject = ko.observable();
	this.performProgressBar = new ProgressBarViewModel('checkout-' + graph.repoPath, 1000);
}
GraphActions.DropareaBase.prototype.dragEnter = function(dragObject) {
	if (!this.visible()) return;
	this.graph.hoverGraphAction(this);
	this.dragObject(dragObject);
}
GraphActions.DropareaBase.prototype.dragLeave = function() {
	if (!this.visible()) return;
	this.graph.hoverGraphAction(null);
	this.dragObject(null);
}

GraphActions.MoveDroparea = function(graph, node) {
	var self = this;
	GraphActions.DropareaBase.call(this, graph);
	this.node = node;
	this.visible = ko.computed(function() {
		return self.graph.showDropTargets() && self.graph.draggingRef().node() != self.node;
	});
	this.style = ko.computed(function() { return 'move ' + (self.visible() ? 'show' : ''); });
}
inherits(GraphActions.MoveDroparea, GraphActions.DropareaBase);
GraphActions.MoveDroparea.prototype.text = 'Move';
GraphActions.MoveDroparea.prototype.visualization = 'move';
GraphActions.MoveDroparea.prototype.drop = function(ref) {
	this.graph.hoverGraphAction(null);
	if (ref.current())
		api.query('POST', '/reset', { path: this.graph.repoPath, to: this.sha1 });
	else if (ref.isTag)
		api.query('POST', '/tags', { path: this.graph.repoPath, name: ref.displayName, startPoint: this.node.sha1, force: true });
	else
		api.query('POST', '/branches', { path: this.graph.repoPath, name: ref.displayName, startPoint: this.node.sha1, force: true });
}

GraphActions.RebaseDroparea = function(graph, node) {
	var self = this;
	GraphActions.DropareaBase.call(this, graph);
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
inherits(GraphActions.RebaseDroparea, GraphActions.DropareaBase);
GraphActions.RebaseDroparea.prototype.text = 'Rebase';
GraphActions.RebaseDroparea.prototype.visualization = 'rebase';
GraphActions.RebaseDroparea.prototype.drop = function(ref) {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/rebase', { path: this.graph.repoPath, onto: this.node.sha1 });
}

GraphActions.MergeDroparea = function(graph, node) {
	var self = this;
	GraphActions.DropareaBase.call(this, graph);
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
inherits(GraphActions.MergeDroparea, GraphActions.DropareaBase);
GraphActions.MergeDroparea.prototype.text = 'Merge';
GraphActions.MergeDroparea.prototype.visualization = 'merge';
GraphActions.MergeDroparea.prototype.drop = function(ref) {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/merge', { path: this.graph.repoPath, with: this.node.sha1 });
}

GraphActions.PushDroparea = function(graph, node) {
	var self = this;
	GraphActions.DropareaBase.call(this, graph);
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
inherits(GraphActions.PushDroparea, GraphActions.DropareaBase);
GraphActions.PushDroparea.prototype.text = 'Push';
GraphActions.PushDroparea.prototype.visualization = 'push';
GraphActions.PushDroparea.prototype.drop = function(ref) {
	var self = this;
	this.graph.hoverGraphAction(null);
	var programEventListener = function(event) {
		if (event.event == 'credentialsRequested') self.performProgressBar.pause();
		else if (event.event == 'credentialsProvided') self.performProgressBar.unpause();
	};
	this.graph.repository.main.programEvents.add(programEventListener);
	this.performProgressBar.start();
	api.query('POST', '/push', { path: this.graph.repoPath, socketId: api.socketId, localBranch: ref.displayName, remoteBranch: ref.displayName }, function(err, res) {
		self.graph.repository.main.programEvents.remove(programEventListener);
		self.performProgressBar.stop();
		self.graph.loadNodesFromApi();
	});
}

GraphActions.CheckoutDroparea = function(graph, node) {
	var self = this;
	GraphActions.DropareaBase.call(this, graph);
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
inherits(GraphActions.CheckoutDroparea, GraphActions.DropareaBase);
GraphActions.CheckoutDroparea.prototype.text = 'Checkout';
GraphActions.CheckoutDroparea.prototype.visualization = 'checkout';
GraphActions.CheckoutDroparea.prototype.drop = function(ref) {
	var self = this;
	this.graph.hoverGraphAction(null);
	this.performProgressBar.start();
	api.query('POST', '/checkout', { path: this.graph.repoPath, name: ref.displayName }, function(err) {
		self.performProgressBar.stop();
	});
}

GraphActions.DeleteDroparea = function(graph, node) {
	var self = this;
	GraphActions.DropareaBase.call(this, graph);
	this.node = node;
	this.ref = this.dragObject;
	this.visible = ko.computed(function() {
		return self.graph.showDropTargets() && 
			self.graph.draggingRef().node() == self.node &&
			!self.graph.draggingRef().current();
	});
	this.style = ko.computed(function() { return 'delete ' + (self.visible() ? 'show' : ''); });
}
inherits(GraphActions.DeleteDroparea, GraphActions.DropareaBase);
GraphActions.DeleteDroparea.prototype.text = 'Delete';
GraphActions.DeleteDroparea.prototype.visualization = 'delete';
GraphActions.DeleteDroparea.prototype.drop = function(ref) {
	var self = this;
	this.graph.hoverGraphAction(null);
	var url = ref.isTag ? '/tags' : '/branches';
	this.performProgressBar.start();
	api.query('DELETE', url, { path: this.graph.repoPath, name: ref.displayName, remote: ref.isRemote }, function(err) {
		self.performProgressBar.stop();
		self.graph.loadNodesFromApi();
	});
}


GraphActions.ClickableBase = function(graph) {
	this.graph = graph;
}
GraphActions.ClickableBase.prototype.mouseover = function() {
	this.graph.hoverGraphAction(this);
}
GraphActions.ClickableBase.prototype.mouseout = function() {
	this.graph.hoverGraphAction(null);
}

GraphActions.PushClickable = function(graph, ref) {
	var self = this;
	GraphActions.ClickableBase.call(this, graph);
	this.ref = ko.observable(ref);
	this.visible = ko.computed(function() {
		if (self.ref().remoteRef())
			return self.ref().remoteRef().node() != self.ref().node() && self.ref().remoteIsAncestor();
		else if (self.graph.hasRemotes()) return true;
	});
}
inherits(GraphActions.PushClickable, GraphActions.ClickableBase);
GraphActions.PushClickable.prototype.style = 'push';
GraphActions.PushClickable.prototype.icon = 'P';
GraphActions.PushClickable.prototype.tooltip = 'Push to remote';
GraphActions.PushClickable.prototype.visualization = 'push';
GraphActions.PushClickable.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/push', { path: this.graph.repoPath, socketId: api.socketId, localBranch: this.ref().displayName }, function(err, res) {
	});
}


GraphActions.ResetClickable = function(graph, ref) {
	var self = this;
	GraphActions.ClickableBase.call(this, graph);
	this.ref = ko.observable(ref);
	this.visible = ko.computed(function() {
		return self.ref().remoteRef() && self.ref().remoteRef().node() != self.ref().node() && !self.ref().remoteIsOffspring();
	});
}
inherits(GraphActions.ResetClickable, GraphActions.ClickableBase);
GraphActions.ResetClickable.prototype.style = 'reset';
GraphActions.ResetClickable.prototype.icon = 'R';
GraphActions.ResetClickable.prototype.tooltip = 'Reset to remote';
GraphActions.ResetClickable.prototype.visualization = 'reset';
GraphActions.ResetClickable.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/reset', { path: this.graph.repoPath, to: this.ref.remoteRef().name });
}

GraphActions.RebaseClickable = function(graph, ref) {
	var self = this;
	GraphActions.ClickableBase.call(this, graph);
	this.ref = ko.observable(ref);
	this.onto = ko.computed(function() {
		return self.ref().remoteRef();
	});
	this.visible = ko.computed(function() {
		return self.onto() && self.onto().node() != self.ref().node() && !self.ref().remoteIsAncestor() && !self.ref().remoteIsOffspring();
	});
}
inherits(GraphActions.RebaseClickable, GraphActions.ClickableBase);
GraphActions.RebaseClickable.prototype.style = 'rebase';
GraphActions.RebaseClickable.prototype.icon = 'R';
GraphActions.RebaseClickable.prototype.tooltip = 'Rebase on remote';
GraphActions.RebaseClickable.prototype.visualization = 'rebase';
GraphActions.RebaseClickable.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/rebase', { path: this.graph.repoPath, onto: this.onto().name });
}

GraphActions.PullClickable = function(graph, ref) {
	var self = this;
	GraphActions.ClickableBase.call(this, graph);
	this.ref = ko.observable(ref);
	this.visible = ko.computed(function() {
		return self.ref().remoteRef() && self.ref().remoteRef().node() != self.ref().node() && self.ref().remoteIsOffspring();
	});
}
inherits(GraphActions.PullClickable, GraphActions.ClickableBase);
GraphActions.PullClickable.prototype.style = 'pull';
GraphActions.PullClickable.prototype.icon = 'P';
GraphActions.PullClickable.prototype.tooltip = 'Pull to remote';
GraphActions.PullClickable.prototype.visualization = 'pull';
GraphActions.PullClickable.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/reset', { path: this.graph.repoPath, to: this.ref.remoteRef().name });
}

