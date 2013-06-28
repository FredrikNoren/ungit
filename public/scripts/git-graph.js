
if (typeof exports !== 'undefined') {
	ko = require('./lib/knockout-2.2.1.js');
	Vector2 = require('./vector2.js');
	var gitGraphActions = require('./git-graph-actions.js');
	MoveDropareaGraphAction = gitGraphActions.MoveDropareaGraphAction;
	RebaseDropareaGraphAction = gitGraphActions.RebaseDropareaGraphAction;
	MergeDropareaGraphAction = gitGraphActions.MergeDropareaGraphAction;
	PushClickableGraphAction = gitGraphActions.PushClickableGraphAction;
	ResetClickableGraphAction = gitGraphActions.ResetClickableGraphAction;
	RebaseClickableGraphAction = gitGraphActions.RebaseClickableGraphAction;
	PullClickableGraphAction = gitGraphActions.PullClickableGraphAction;
	moment = require('moment');
	_ = require('underscore');
}

var GitGraphViewModel = function(repository) {
	var self = this;
	this.maxNNodes = 10;
	this.nodes = ko.observable([]);
	this.refs = ko.observableArray();
	this.daySeparators = ko.observable();
	this.nodesById = {};
	this.refsByRefName = {};
	this.repository = repository;
	this.repoPath = repository.repoPath;
	this.isLoading = ko.observable(false);
	this.nodesLoader = new ProgressBarViewModel('gitgraph-' + repository.repoPath, 1000);
	this.activeBranch = ko.observable();
	this.HEAD = ko.observable();
	this.hoverGraphAction = ko.observable();
	this.draggingRef = ko.observable();
	this.hasRemotes = ko.observable(false);
	this.showDropTargets = ko.computed(function() {
		return !!self.draggingRef();
	});
}
if (typeof exports !== 'undefined') exports.GitGraphViewModel = GitGraphViewModel;

GitGraphViewModel.prototype.scrolledToEnd = function() {
	this.maxNNodes = this.maxNNodes + 10;
	this.loadNodesFromApi();
}
GitGraphViewModel.prototype.loadNodesFromApi = function() {
	var self = this;
	this.isLoading(true);
	this.nodesLoader.start();
	api.query('GET', '/log', { path: this.repoPath, limit: this.maxNNodes }, function(err, logEntries) {
		if (err) { self.nodesLoader.stop(); return; }
		self.setNodesFromLog(logEntries);
		self.isLoading(false);
		self.nodesLoader.stop();
	});
}

GitGraphViewModel.prototype.setNodesFromLog = function(nodes) {
	var self = this;
	var nodeVMs = [];
	nodes.forEach(function(node) {
		node.graph = self;
		var nodeViewModel = self.nodesById[node.sha1] || new NodeViewModel(node);
		nodeVMs.push(nodeViewModel);
		self.nodesById[node.sha1] = nodeViewModel;
		if (node.refs) {
			var refVMs = node.refs.map(function(ref) {
				var refViewModel = self.refsByRefName[ref];
				if (!refViewModel) {
					var refViewModel = self.refsByRefName[ref] = new RefViewModel({ name: ref, graph: self });
					self.refs.push(refViewModel);
				}
				refViewModel.node(nodeViewModel);
				return refViewModel;
			});
			refVMs.sort(function(a, b) {
				if (a.isLocalBranch && !b.isLocalBranch) return -1;
				if (!a.isLocalBranch && b.isLocalBranch) return 1;
				return a.displayName < b.displayName ? -1 : 1;
			});
			nodeViewModel.refs(refVMs);
		}
	});
	this.HEAD(GitGraphViewModel.getHEAD(nodeVMs));
	this.setNodes(nodeVMs);
}

GitGraphViewModel.getHEAD = function(nodes) {
	return _.find(nodes, function(node) { return _.find(node.refs(), function(r) { return r.isLocalHEAD; }); });
}

GitGraphViewModel.traverseNodeParents = function(node, nodesById, callback) {
	if (node.index() >= this.maxNNodes) return;
	callback(node);
	node.parents.forEach(function(parentId) {
		var parent = nodesById[parentId];
		if (parent)
			GitGraphViewModel.traverseNodeParents(parent, nodesById, callback);
	});
}

GitGraphViewModel.markNodesIdealogicalBranches = function(nodes, nodesById) {
	var recursivelyMarkBranch = function(e, idealogicalBranch) {
		GitGraphViewModel.traverseNodeParents(e, nodesById, function(node) {
			node.idealogicalBranch = idealogicalBranch;
		});
	}
	var getIdeologicalBranch = function(e) {
		return _.find(e.refs(), function(ref) { return ref.isBranch; });
	}
	var master;
	nodes.forEach(function(e) {
		var i = 0;
		var idealogicalBranch = getIdeologicalBranch(e);
		if (!idealogicalBranch) return;
		if (idealogicalBranch.name == 'refs/heads/master') master = e;
		recursivelyMarkBranch(e, idealogicalBranch);
	});
	if (master) {
		recursivelyMarkBranch(master, master.idealogicalBranch);
	}
}

GitGraphViewModel.randomColor = function() {
	var randomHex = function() {
		var r = Math.floor(Math.random() * 256).toString(16);
		if (r.length == 1) r = '0' + r;
		return r;
	}
	return '#' + randomHex() + randomHex() + randomHex();
}

GitGraphViewModel.prototype.setNodes = function(nodes) {
	var daySeparators = [];
	nodes.sort(function(a, b) { return b.commitTime.unix() - a.commitTime.unix(); });
	nodes.forEach(function(node, i) { node.index(i); });
	nodes = nodes.slice(0, GitGraphViewModel.maxNNodes);

	var HEAD = this.HEAD();
	GitGraphViewModel.markNodesIdealogicalBranches(nodes, this.nodesById);

	// Make sure refs know their "remote"
	for(var refName in this.refsByRefName) {
		var ref = this.refsByRefName[refName];
		if (ref.isLocalBranch) {
			var remote = this.refsByRefName['refs/remotes/origin/' + ref.displayName];
			if (remote) {
				ref.remoteRef(remote);
				remote.localRef(ref);
				remote.color = ref.color;
			}
		}
	}

	var updateTimeStamp = moment().valueOf();

	// Mark timestamps
	if (HEAD) {
		GitGraphViewModel.traverseNodeParents(HEAD, this.nodesById, function(node) {
			node.ancestorOfHEADTimeStamp = updateTimeStamp;
		});
	}

	// Filter out nodes which doesn't have a branch (staging and orphaned nodes)
	nodes = nodes.filter(function(node) { return !!node.idealogicalBranch || node.ancestorOfHEADTimeStamp == updateTimeStamp; })

	//var concurrentBranches = { };

	var branchSlots = [];
	var y = 30; // Leave room for the "commit node" (see logrednerer.js)

	// Then iterate from the bottom to fix the orders of the branches
	for (var i = nodes.length - 1; i >= 0; i--) {
		var node = nodes[i];
		if (node.ancestorOfHEADTimeStamp == updateTimeStamp) continue;
		var idealogicalBranch = node.idealogicalBranch;

		// First occurence of the branch, find an empty slot for the branch
		if (idealogicalBranch.lastSlottedTimeStamp != updateTimeStamp) {
			idealogicalBranch.lastSlottedTimeStamp = updateTimeStamp;
			var slot = 0;
			for(;slot < branchSlots.length; slot++)
				if (branchSlots[slot] === undefined) break;
			if (slot == branchSlots.length) {
				branchSlots.push(idealogicalBranch);
				slot = branchSlots.length - 1;
			}
			idealogicalBranch.branchOrder = slot;
			branchSlots[slot] = slot;
		}

		node.branchOrder = idealogicalBranch.branchOrder;

		// Free branch slots when we reach the end of a branch
		/*if (node == idealogicalBranch.node()) {
			branchSlots[idealogicalBranch.branchOrder] = undefined;
		}*/
	}

	var prevNode;
	nodes.forEach(function(node) {
		if (node.ancestorOfHEADTimeStamp == updateTimeStamp) {
			if (!prevNode)
				y += 90;
			else if (prevNode.ancestorOfHEADTimeStamp == updateTimeStamp)
				y += 120;
			else
				y += 60;
			node.x(30);
			node.radius(30);
			node.ancestorOfHEAD(true);
		} else {
			y += 60;
			node.x(30 + 90 * (branchSlots.length - node.branchOrder));
			node.radius(15);
			node.ancestorOfHEAD(false);
		}
		node.y(y);

		if (prevNode && prevNode.commitTime.dayOfYear() != node.commitTime.dayOfYear()) {
			daySeparators.push({ x: 0, y: node.y(), date: node.commitTime.format('ll') });
		}

		prevNode = node;
	});

	this.nodes(nodes);
	this.daySeparators(daySeparators);
}

NodeViewModel = function(args) {
	var self = this;
	this.graph = args.graph;
	this.x = ko.observable(0);
	this.y = ko.observable(0);
	this.position = ko.computed(function() {
		return new Vector2(self.x(), self.y());
	});
	this.radius = ko.observable(30);
	this.boxDisplayX = ko.computed(function() {
		return self.x();
	});
	this.boxDisplayY = ko.computed(function() {
		return self.y();
	});
	this.commitTime = moment(args.commitDate);
	this.authorTime = moment(args.authorDate);
	this.parents = args.parents || [];
	var message = args.message.split('\n');
	this.message = args.message;
	this.title = message[0];
	this.body = message.slice(2).join('\n');
	this.sha1 = args.sha1;
	this.authorDate = ko.observable(moment(args.authorDate).fromNow());
	setInterval(function() { self.authorDate(moment(args.authorDate).fromNow()); }, 1000 * 60);
	this.authorName = args.authorName;
	this.authorEmail = args.authorEmail;
	this.index = ko.observable();
	this.ancestorOfHEAD = ko.observable(false);
	this.logBoxVisible = ko.computed(function() {
		return self.ancestorOfHEAD();
	})
	this.refs = ko.observable([]);
	this.branches = ko.computed(function() {
		return self.refs().filter(function(r) { return r.isBranch; });
	});
	this.tags = ko.computed(function() {
		return self.refs().filter(function(r) { return r.isTag; });
	});
	this.newBranchName = ko.observable();
	this.newBranchNameHasFocus = ko.observable(true);
	this.newBranchNameHasFocus.subscribe(function(newValue) {
		if (!newValue) self.branchingFormVisible(false);
	})
	this.branchingFormVisible = ko.observable(false);

	this.dropareaGraphActions = [
		new MoveDropareaGraphAction(this.graph, this),
		new RebaseDropareaGraphAction(this.graph, this),
		new MergeDropareaGraphAction(this.graph, this),
		new PushDropareaGraphAction(this.graph, this),
		new CheckoutDropareaGraphAction(this.graph, this),
		new DeleteDropareaGraphAction(this.graph, this)
	];
}
NodeViewModel.prototype.showBranchingForm = function() {
	this.branchingFormVisible(true);
	this.newBranchNameHasFocus(true);
}
NodeViewModel.prototype.createBranch = function() {
	api.query('POST', '/branches', { path: this.graph.repoPath, name: this.newBranchName(), startPoint: this.sha1 });
	this.branchingFormVisible(false);
	this.newBranchName('');
}
NodeViewModel.prototype.createTag = function() {
	api.query('POST', '/tags', { path: this.graph.repoPath, name: this.newBranchName(), startPoint: this.sha1 });
	this.branchingFormVisible(false);
	this.newBranchName('');
}
NodeViewModel.prototype.isAncestor = function(node) {
	if (this.index() >= GitGraphViewModel.maxNNodes) return false;
	if (node == this) return true;
	for (var v in this.parents) {
		var n = this.graph.nodesById[this.parents[v]];
		if (n && n.isAncestor(node)) return true;
	}
	return false;
}
NodeViewModel.prototype.getPathToCommonAncestor = function(node) {
	var path = [];
	var thisNode = this;
	while (!node.isAncestor(thisNode)) {
		path.push(thisNode);
		thisNode = this.graph.nodesById[thisNode.parents[0]];
	}
	path.push(thisNode);
	return path;
}



var RefViewModel = function(args) {
	var self = this;
	this.node = ko.observable();
	this.boxDisplayX = ko.computed(function() {
		if (!self.node()) return 0;
		return self.node().x();
	});
	this.boxDisplayY = ko.computed(function() {
		if (!self.node()) return 0;
		return self.node().y();
	});
	this.name = args.name;
	this.displayName = this.name;
	this.isLocalTag = this.name.indexOf('tag: refs/tags/') == 0;
	this.isRemoteTag = this.name.indexOf('remote-tag: refs/tags/') == 0;
	this.isTag = this.isLocalTag || this.isRemoteTag;
	this.isLocalHEAD = this.name == 'HEAD';
	this.isRemoteHEAD = this.name == 'refs/remotes/origin/HEAD';
	this.isLocalBranch = this.name.indexOf('refs/heads/') == 0;
	this.isRemoteBranch = this.name.indexOf('refs/remotes/origin/') == 0 && !this.isRemoteHEAD;
	this.isHEAD = this.isLocalHEAD || this.isRemoteHEAD;
	this.isBranch = this.isLocalBranch || this.isRemoteBranch;
	this.isRemote = this.isRemoteBranch || this.isRemoteTag;
	this.isLocal = this.isLocalBranch || this.isLocalTag;
	if (this.isLocalBranch) this.displayName = this.name.slice('refs/heads/'.length);
	if (this.isRemoteBranch) this.displayName = this.name.slice('refs/remotes/origin/'.length);
	if (this.isLocalTag) this.displayName = this.name.slice('tag: refs/tags/'.length);
	if (this.isRemoteTag) this.displayName = this.name.slice('remote-tag: refs/tags/'.length);
	this.show = true;
	this.graph = args.graph;
	this.remoteRef = ko.observable();
	this.localRef = ko.observable();
	this.current = ko.computed(function() {
		return self.isLocalBranch && self.graph.activeBranch() == self.displayName;
	});
	this.canBePushed = ko.computed(function() {
		return self.isLocal && self.graph.hasRemotes();
	});
	this.color = GitGraphViewModel.randomColor();
	this.remoteIsAncestor = ko.computed(function() {
		if (!self.remoteRef()) return false;
		return self.node().isAncestor(self.remoteRef().node());
	});
	this.remoteIsOffspring = ko.computed(function() {
		if (!self.remoteRef()) return false;
		return self.remoteRef().node().isAncestor(self.node());
	});
	this.graphActions = [
		new PushClickableGraphAction(this.graph, this),
		new ResetClickableGraphAction(this.graph, this),
		new RebaseClickableGraphAction(this.graph, this),
		new PullClickableGraphAction(this.graph, this)
	];
}
RefViewModel.prototype.dragStart = function() {
	this.graph.draggingRef(this);
}
RefViewModel.prototype.dragEnd = function() {
	this.graph.draggingRef(null);
}
