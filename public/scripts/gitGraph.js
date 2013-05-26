

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
			nodeViewModel.refsViewModels(refVMs);
		}
	});
	GitGraphViewModel.normalize(nodeVMs, this.nodesById, this.refsByRefName);
	this.nodes(nodeVMs);
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
		return _.find(e.refs, function(ref) { return ref && ref != 'HEAD' && ref.indexOf('tag: ') != 0; });
	}
	var master;
	nodes.forEach(function(e) {
		var i = 0;
		var idealogicalBranch = getIdeologicalBranch(e);
		if (idealogicalBranch == 'refs/heads/master') master = e;
		if (!idealogicalBranch) return;
		recursivelyMarkBranch(e, idealogicalBranch);
	});
	if (master) {
		recursivelyMarkBranch(master, 'refs/heads/master');
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
	nodes.sort(function(a, b) { return a.time.unix() < b.time.unix(); });

	var HEAD = _.find(nodes, function(node) { return node.refs.indexOf('HEAD') !== -1; });
	if (!HEAD) return;
	GitGraphViewModel.markNodesIdealogicalBranches(HEAD, nodes, nodesById);

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
		var idealogicalBranch = refsByRefName[node.idealogicalBranch];

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
			console.log('FREE', idealogicalBranch.branchOrder);
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
	this.refs = args.refs || [];
	this.parents = args.parents || [];
	this.title = args.title;
	this.sha1 = args.sha1;
	this.date = args.date;
	this.authorName = args.authorName;
	this.authorEmail = args.authorEmail;
	this.logBoxVisible = ko.observable(true);
	this.refsViewModels = ko.observable([]);
	this.branches = ko.computed(function() {
		return self.refsViewModels().filter(function(r) { return r.isBranch; });
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
	this.branchName = this.name.slice('refs/heads/'.length);
	this.isBranch = this.name.indexOf('refs/heads/') != -1;
	this.graph = args.graph;
	this.current = ko.computed(function() {
		return self.isBranch && self.graph.activeBranch() == self.branchName;
	});
	this.color = GitGraphViewModel.randomColor();
}
RefViewModel.prototype.checkout = function() {
	api.query('POST', '/branch', { path: this.graph.repoPath, name: this.branchName });
}