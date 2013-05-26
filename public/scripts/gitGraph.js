

var GitGraphViewModel = function(repoPath) {
	this.nodes = ko.observable([]);
	this.refs = ko.observableArray();
	this.nodesById = {};
	this.refsByRefName = {};
	this.repoPath = repoPath;
	this.activeBranch = ko.observable();
}

GitGraphViewModel.prototype.setNodes = function(nodes) {
	var self = this;
	var nodeVMs = [];
	nodes.forEach(function(node) {
		node.graph = self;
		var nodeViewModel = new NodeViewModel(node);
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
	nodeVMs = GitGraphViewModel.normalize(nodeVMs, this.nodesById, this.refsByRefName);
	this.nodes(nodeVMs);
}

GitGraphViewModel.prototype.getHEAD = function() {
	return GitGraphViewModel.getHEAD(this.nodes());
}

GitGraphViewModel.getHEAD = function(nodes) {
	return _.find(nodes, function(node) { return _.find(node.refs(), function(r) { return r.isLocalHEAD; }); });
}

GitGraphViewModel.traverseNodeParents = function(node, nodesById, callback) {
	callback(node);
	node.parents.forEach(function(parentId) {
		var parent = nodesById[parentId];
		GitGraphViewModel.traverseNodeParents(parent, nodesById, callback);
	});
}

GitGraphViewModel.markNodesIdealogicalBranches = function(HEAD, nodes, nodesById) {
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

GitGraphViewModel.normalize = function(nodes, nodesById, refsByRefName) {
	nodes.sort(function(a, b) { return b.time.unix() - a.time.unix(); });

	var HEAD = GitGraphViewModel.getHEAD(nodes);
	if (!HEAD) return;
	GitGraphViewModel.markNodesIdealogicalBranches(HEAD, nodes, nodesById);

	// Filter out nodes which doesn't have a branch (staging and orphaned nodes)
	nodes = nodes.filter(function(node) { return node.idealogicalBranch; })

	var updateTimeStamp = moment().valueOf();

	GitGraphViewModel.traverseNodeParents(HEAD, nodesById, function(node) {
		node.ancestorOfHEADTimeStamp = updateTimeStamp;
	});

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
			node.logBoxVisible(true);
		} else {
			y += 60;
			node.x(30 + 60 * (branchSlots.length - node.branchOrder));
			node.radius(15);
			node.logBoxVisible(false);
		}
		node.y(y);

		prevNode = node;
	});

	return nodes;
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
	this.time = moment(args.date);
	this.parents = args.parents || [];
	this.title = args.title;
	this.sha1 = args.sha1;
	this.date = ko.observable(moment(args.date).fromNow());
	setInterval(function() { self.date(moment(args.date).fromNow()); }, 1000 * 60);
	this.authorName = args.authorName;
	this.authorEmail = args.authorEmail;
	this.logBoxVisible = ko.observable(true);
	this.refs = ko.observable([]);
	this.branches = ko.computed(function() {
		return self.refs().filter(function(r) { return r.isBranch; });
	});
	this.newBranchName = ko.observable();
}
NodeViewModel.prototype.createBranch = function() {
	api.query('POST', '/branches', { path: this.graph.repoPath, name: this.newBranchName(), startPoint: this.sha1 });
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
	this.isTag = this.name.indexOf('tag: refs/tags/') == 0;
	this.isLocalHEAD = this.name == 'HEAD';
	this.isRemoteHEAD = this.name == 'refs/remotes/origin/HEAD';
	this.isLocalBranch = this.name.indexOf('refs/heads/') == 0;
	this.isRemoteBranch = this.name.indexOf('refs/remotes/origin/') == 0 && !this.isRemoteHEAD;
	this.isHEAD = this.isLocalHEAD || this.isRemoteHEAD;
	this.isBranch = this.isLocalBranch || this.isRemoteBranch;
	this.isRemote = this.isRemoteBranch;
	if (this.isLocalBranch) this.displayName = this.name.slice('refs/heads/'.length);
	if (this.isRemoteBranch) this.displayName = this.name.slice('refs/remotes/origin/'.length);
	this.show = true;
	this.graph = args.graph;
	this.current = ko.computed(function() {
		return self.isLocalBranch && self.graph.activeBranch() == self.displayName;
	});
	this.color = GitGraphViewModel.randomColor();
}
RefViewModel.prototype.checkout = function() {
	api.query('POST', '/branch', { path: this.graph.repoPath, name: this.displayName });
}