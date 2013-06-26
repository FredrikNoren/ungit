

var DropareaGraphAction = function(graph) {
	this.graph = graph;
}
DropareaGraphAction.prototype.dragenter = function() {
	this.graph.hoverGraphAction(this);
}
DropareaGraphAction.prototype.dragleave = function() {
	this.graph.hoverGraphAction(null);
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
inherits(MoveDropareaGraphAction, DropareaGraphAction);
MoveDropareaGraphAction.prototype.text = 'Move';
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
	this.visible = ko.computed(function() {
		return self.graph.showDropTargets() && 
			!self.node.isAncestor(self.graph.draggingRef().node()) &&
			!self.graph.draggingRef().node().isAncestor(self.node) &&
			self.graph.draggingRef().current();
	});
	this.style = ko.computed(function() { return 'rebase ' + (self.visible() ? 'show' : ''); });
}
inherits(RebaseDropareaGraphAction, DropareaGraphAction);
RebaseDropareaGraphAction.prototype.text = 'Rebase';
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
inherits(MergeDropareaGraphAction, DropareaGraphAction);
MergeDropareaGraphAction.prototype.text = 'Merge';
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
	this.ref = ref;
	this.visible = ko.computed(function() {
		if (self.ref.remoteRef())
			return self.ref.remoteRef().node() != self.ref.node() && self.ref.remoteIsAncestor();
		else if (self.graph.hasRemotes()) return true;
	});
}
inherits(PushClickableGraphAction, ClickableGraphAction);
PushClickableGraphAction.prototype.style = 'push';
PushClickableGraphAction.prototype.icon = 'P';
PushClickableGraphAction.prototype.tooltip = 'Push to remote';
PushClickableGraphAction.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	this.graph.repo.main.showDialog(new PushDialogViewModel({ repoPath: this.graph.repoPath }));
}


var ResetClickableGraphAction = function(graph, ref) {
	var self = this;
	ClickableGraphAction.call(this, graph);
	this.ref = ref;
	this.visible = ko.computed(function() {
		return self.ref.remoteRef() && self.ref.remoteRef().node() != self.ref.node() && !self.ref.remoteIsOffspring();
	});
}
inherits(ResetClickableGraphAction, ClickableGraphAction);
ResetClickableGraphAction.prototype.style = 'reset';
ResetClickableGraphAction.prototype.icon = 'R';
ResetClickableGraphAction.prototype.tooltip = 'Reset to remote';
ResetClickableGraphAction.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/reset', { path: this.graph.repoPath, to: this.ref.remoteRef().name });
}

var RebaseClickableGraphAction = function(graph, ref) {
	var self = this;
	ClickableGraphAction.call(this, graph);
	this.ref = ref;
	this.visible = ko.computed(function() {
		return self.ref.remoteRef() && self.ref.remoteRef().node() != self.ref.node() && !self.ref.remoteIsAncestor() && !self.ref.remoteIsOffspring();
	});
}
inherits(RebaseClickableGraphAction, ClickableGraphAction);
RebaseClickableGraphAction.prototype.style = 'rebase';
RebaseClickableGraphAction.prototype.icon = 'R';
RebaseClickableGraphAction.prototype.tooltip = 'Rebase on remote';
RebaseClickableGraphAction.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/rebase', { path: this.graph.repoPath, onto: this.ref.remoteRef().name });
}

var PullClickableGraphAction = function(graph, ref) {
	var self = this;
	ClickableGraphAction.call(this, graph);
	this.ref = ref;
	this.visible = ko.computed(function() {
		return self.ref.remoteRef() && self.ref.remoteRef().node() != self.ref.node() && self.ref.remoteIsOffspring();
	});
}
inherits(PullClickableGraphAction, ClickableGraphAction);
PullClickableGraphAction.prototype.style = 'pull';
PullClickableGraphAction.prototype.icon = 'P';
PullClickableGraphAction.prototype.tooltip = 'Pull to remote';
PullClickableGraphAction.prototype.perform = function() {
	this.graph.hoverGraphAction(null);
	api.query('POST', '/reset', { path: this.graph.repoPath, to: this.ref.remoteRef().name });
}

