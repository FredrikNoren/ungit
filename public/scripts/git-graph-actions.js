
if (typeof exports !== 'undefined') {
	ko = require('./lib/knockout-2.2.1.js');
	inherits = require('./utils').inherits;
}

var DropareaGraphAction = function(graph) {
	this.graph = graph;
	this.dragObject = ko.observable();
}
DropareaGraphAction.prototype.dragEnter = function(dragObject) {
	if (!this.visible()) return;
	this.graph.hoverGraphAction(this);
	this.dragObject(dragObject);
}
DropareaGraphAction.prototype.dragLeave = function() {
	if (!this.visible()) return;
	this.graph.hoverGraphAction(null);
	this.dragObject(null);
}

var MoveDropareaGraphAction = function(graph, node) {
	var self = this;
	DropareaGraphAction.call(this, graph);
	this.node = node;
	this.visible = ko.computed(function() {
		return self.graph.showDropTargets() && self.graph.draggingRef().node() != self.node;
	});
	this.style = ko.computed(function() { return 'move ' + (self.visible() ? 'show' : ''); });
}
if (typeof exports !== 'undefined') exports.MoveDropareaGraphAction = MoveDropareaGraphAction;
inherits(MoveDropareaGraphAction, DropareaGraphAction);
MoveDropareaGraphAction.prototype.text = 'Move';
MoveDropareaGraphAction.prototype.visualization = 'move';
MoveDropareaGraphAction.prototype.drop = function(ref) {
	this.graph.hoverGraphAction(null);
	if (ref.current())
		api.query('POST', '/reset', { path: this.graph.repoPath, to: this.sha1 });
	else if (ref.isTag)
		api.query('POST', '/tags', { path: this.graph.repoPath, name: ref.displayName, startPoint: this.node.sha1, force: true });
	else
		api.query('POST', '/branches', { path: this.graph.repoPath, name: ref.displayName, startPoint: this.node.sha1, force: true });
}

var RebaseDropareaGraphAction = function(graph, node) {
	var self = this;
	DropareaGraphAction.call(this, graph);
	this.node = node;
	this.ref = this.dragObject;
	this.onto = ko.observable(this.node);
	this.visible = ko.computed(function() {
		return self.graph.showDropTargets() && 
			!self.node.isAncestor(self.graph.draggingRef().node()) &&
			!self.graph.draggingRef().node().isAncestor(self.node) &&
			self.graph.draggingRef().current();
	});
	this.style = ko.computed(function() { return 'rebase ' + (self.visible() ? 'show' : ''); });
}
if (typeof exports !== 'undefined') exports.RebaseDropareaGraphAction = RebaseDropareaGraphAction;
inherits(RebaseDropareaGraphAction, DropareaGraphAction);
RebaseDropareaGraphAction.prototype.text = 'Rebase';
RebaseDropareaGraphAction.prototype.visualization = 'rebase';
RebaseDropareaGraphAction.prototype.drop = function(ref) {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/rebase', { path: this.graph.repoPath, onto: this.node.sha1 });
}

var MergeDropareaGraphAction = function(graph, node) {
	var self = this;
	DropareaGraphAction.call(this, graph);
	this.node = node;
	this.visible = ko.computed(function() {
		return self.graph.showDropTargets() && 
			!self.node.isAncestor(self.graph.draggingRef().node()) &&
			!self.graph.draggingRef().node().isAncestor(self.node) &&
			self.graph.draggingRef().current();
	});
	this.style = ko.computed(function() { return 'merge ' + (self.visible() ? 'show' : ''); });
}
if (typeof exports !== 'undefined') exports.MergeDropareaGraphAction = MergeDropareaGraphAction;
inherits(MergeDropareaGraphAction, DropareaGraphAction);
MergeDropareaGraphAction.prototype.text = 'Merge';
MergeDropareaGraphAction.prototype.visualization = 'merge';
MergeDropareaGraphAction.prototype.drop = function(ref) {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/merge', { path: this.graph.repoPath, with: this.node.sha1 });
}




var ClickableGraphAction = function(graph) {
	this.graph = graph;
}
ClickableGraphAction.prototype.mouseover = function() {
	this.graph.hoverGraphAction(this);
}
ClickableGraphAction.prototype.mouseout = function() {
	this.graph.hoverGraphAction(null);
}

var PushClickableGraphAction = function(graph, ref) {
	var self = this;
	ClickableGraphAction.call(this, graph);
	this.ref = ko.observable(ref);
	this.visible = ko.computed(function() {
		if (self.ref().remoteRef())
			return self.ref().remoteRef().node() != self.ref().node() && self.ref().remoteIsAncestor();
		else if (self.graph.hasRemotes()) return true;
	});
}
if (typeof exports !== 'undefined') exports.PushClickableGraphAction = PushClickableGraphAction;
inherits(PushClickableGraphAction, ClickableGraphAction);
PushClickableGraphAction.prototype.style = 'push';
PushClickableGraphAction.prototype.icon = 'P';
PushClickableGraphAction.prototype.tooltip = 'Push to remote';
PushClickableGraphAction.prototype.visualization = 'push';
PushClickableGraphAction.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	this.graph.repo.main.showDialog(new PushDialogViewModel({ repoPath: this.graph.repoPath }));
}


var ResetClickableGraphAction = function(graph, ref) {
	var self = this;
	ClickableGraphAction.call(this, graph);
	this.ref = ko.observable(ref);
	this.visible = ko.computed(function() {
		return self.ref().remoteRef() && self.ref().remoteRef().node() != self.ref().node() && !self.ref().remoteIsOffspring();
	});
}
if (typeof exports !== 'undefined') exports.ResetClickableGraphAction = ResetClickableGraphAction;
inherits(ResetClickableGraphAction, ClickableGraphAction);
ResetClickableGraphAction.prototype.style = 'reset';
ResetClickableGraphAction.prototype.icon = 'R';
ResetClickableGraphAction.prototype.tooltip = 'Reset to remote';
ResetClickableGraphAction.prototype.visualization = 'reset';
ResetClickableGraphAction.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/reset', { path: this.graph.repoPath, to: this.ref.remoteRef().name });
}

var RebaseClickableGraphAction = function(graph, ref) {
	var self = this;
	ClickableGraphAction.call(this, graph);
	this.ref = ko.observable(ref);
	this.onto = ko.computed(function() {
		return self.ref().remoteRef();
	});
	this.visible = ko.computed(function() {
		return self.onto() && self.onto().node() != self.ref().node() && !self.ref().remoteIsAncestor() && !self.ref().remoteIsOffspring();
	});
}
if (typeof exports !== 'undefined') exports.RebaseClickableGraphAction = RebaseClickableGraphAction;
inherits(RebaseClickableGraphAction, ClickableGraphAction);
RebaseClickableGraphAction.prototype.style = 'rebase';
RebaseClickableGraphAction.prototype.icon = 'R';
RebaseClickableGraphAction.prototype.tooltip = 'Rebase on remote';
RebaseClickableGraphAction.prototype.visualization = 'rebase';
RebaseClickableGraphAction.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/rebase', { path: this.graph.repoPath, onto: this.onto().name });
}

var PullClickableGraphAction = function(graph, ref) {
	var self = this;
	ClickableGraphAction.call(this, graph);
	this.ref = ko.observable(ref);
	this.visible = ko.computed(function() {
		return self.ref().remoteRef() && self.ref().remoteRef().node() != self.ref().node() && self.ref().remoteIsOffspring();
	});
}
if (typeof exports !== 'undefined') exports.PullClickableGraphAction = PullClickableGraphAction;
inherits(PullClickableGraphAction, ClickableGraphAction);
PullClickableGraphAction.prototype.style = 'pull';
PullClickableGraphAction.prototype.icon = 'P';
PullClickableGraphAction.prototype.tooltip = 'Pull to remote';
PullClickableGraphAction.prototype.visualization = 'pull';
PullClickableGraphAction.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/reset', { path: this.graph.repoPath, to: this.ref.remoteRef().name });
}

