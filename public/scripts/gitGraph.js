

var GitGraphViewModel = function(repoPath) {
	this.nodes = ko.observable([]);
	this.refs = ko.observableArray();
	this.daySeparators = ko.observable();
	this.nodesById = {};
	this.refsByRefName = {};
	this.repoPath = repoPath;
	this.activeBranch = ko.observable();
	this.pushHover = ko.observable();
	this.resetHover = ko.observable();
	this.rebaseHover = ko.observable();
}

GitGraphViewModel.prototype.loadNodesFromApi = function() {
	var self = this;
	api.query('GET', '/log', { path: this.repoPath, limit: GitGraphViewModel.maxNNodes }, function(err, logEntries) {
		if (err) return;
		self.setNodesFromLog(logEntries);
	});
}

GitGraphViewModel.prototype.setNodesFromLog = function(nodes) {
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
	this.setNodes(nodeVMs);
}

GitGraphViewModel.prototype.getHEAD = function() {
	return GitGraphViewModel.getHEAD(this.nodes());
}

GitGraphViewModel.getHEAD = function(nodes) {
	return _.find(nodes, function(node) { return _.find(node.refs(), function(r) { return r.isLocalHEAD; }); });
}

GitGraphViewModel.traverseNodeParents = function(node, nodesById, callback) {
	if (node.index() >= GitGraphViewModel.maxNNodes) return;
	callback(node);
	node.parents.forEach(function(parentId) {
		var parent = nodesById[parentId];
		if (parent)
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

GitGraphViewModel.maxNNodes = 100;

GitGraphViewModel.prototype.setNodes = function(nodes) {
	var daySeparators = [];
	nodes.sort(function(a, b) { return b.commitTime.unix() - a.commitTime.unix(); });
	nodes.forEach(function(node, i) { node.index(i); });
	nodes = nodes.slice(0, GitGraphViewModel.maxNNodes);

	var HEAD = GitGraphViewModel.getHEAD(nodes);
	if (!HEAD) return;
	GitGraphViewModel.markNodesIdealogicalBranches(HEAD, nodes, this.nodesById);

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

	// Filter out nodes which doesn't have a branch (staging and orphaned nodes)
	nodes = nodes.filter(function(node) { return node.idealogicalBranch; })

	var updateTimeStamp = moment().valueOf();

	GitGraphViewModel.traverseNodeParents(HEAD, this.nodesById, function(node) {
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
			node.x(30 + 90 * (branchSlots.length - node.branchOrder));
			node.radius(15);
			node.logBoxVisible(false);
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
	this.title = args.title;
	this.sha1 = args.sha1;
	this.authorDate = ko.observable(moment(args.authorDate).fromNow());
	setInterval(function() { self.authorDate(moment(args.authorDate).fromNow()); }, 1000 * 60);
	this.authorName = args.authorName;
	this.authorEmail = args.authorEmail;
	this.index = ko.observable();
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
	do {
		path.push(thisNode);
		thisNode = this.graph.nodesById[thisNode.parents[0]];
	} while (!node.isAncestor(thisNode));
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
	this.remoteRef = ko.observable();
	this.localRef = ko.observable();
	this.current = ko.computed(function() {
		return self.isLocalBranch && self.graph.activeBranch() == self.displayName;
	});
	this.color = GitGraphViewModel.randomColor();
	this.remoteIsAncestor = ko.computed(function() {
		if (!self.remoteRef()) return false;
		return self.node().isAncestor(self.remoteRef().node());
	});
	this.pushVisible = ko.computed(function() { return self.remoteRef() && self.remoteRef().node() != self.node() && self.remoteIsAncestor(); });
	this.rebaseVisible = ko.computed(function() { return self.remoteRef() && self.remoteRef().node() != self.node() && !self.remoteIsAncestor(); });
	this.resetVisible = ko.computed(function() { return self.pushVisible() || self.rebaseVisible(); });
}
RefViewModel.prototype.checkout = function() {
	api.query('POST', '/branch', { path: this.graph.repoPath, name: this.displayName });
}
RefViewModel.prototype.push = function() {
	this.graph.pushHover(null);
	viewModel.dialog(new PushDialogViewModel(this.graph.repoPath));
}
RefViewModel.prototype.reset = function() {
	this.graph.resetHover(null);
	api.query('POST', '/reset', { path: this.graph.repoPath, to: this.remoteRef().name });
}
RefViewModel.prototype.rebase = function() {
	this.graph.rebaseHover(null);
	api.query('POST', '/rebase', { path: this.graph.repoPath, onto: this.remoteRef().name });
}
RefViewModel.prototype.mouseoverPush = function() {
	this.graph.pushHover(this);
}
RefViewModel.prototype.mouseoutPush = function() {
	this.graph.pushHover(null);
}
RefViewModel.prototype.mouseoverReset = function() {
	this.graph.resetHover(this);
}
RefViewModel.prototype.mouseoutReset = function() {
	this.graph.resetHover(null);
}
RefViewModel.prototype.mouseoverRebase = function() {
	this.graph.rebaseHover(this);
}
RefViewModel.prototype.mouseoutRebase = function() {
	this.graph.rebaseHover(null);
}