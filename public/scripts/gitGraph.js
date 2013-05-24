

var GitGraphViewModel = function(repoPath) {
	this.nodes = ko.observable([]);
	this.refs = ko.observableArray();
	this.nodesById = {};
	this.refsByRefName = {};
	this.repoPath = repoPath;
}

GitGraphViewModel.prototype.setNodes = function(nodes) {
	var self = this;
	var nodeVMs = [];
	nodes.forEach(function(node) {
		var nodeViewModel = new NodeViewModel(node);
		nodeVMs.push(nodeViewModel);
		self.nodesById[node.sha1] = nodeViewModel;
		if (node.refs) {
			node.refs.forEach(function(ref) {
				var refViewModel = self.refsByRefName[ref];
				if (!refViewModel) {
					var refViewModel = self.refsByRefName[ref] = new RefViewModel({ name: ref, repoPath: self.repoPath });
					self.refs.push(refViewModel);
				}
				refViewModel.node(nodeViewModel);
			});
		}
	});
	GitGraphViewModel.normalize(nodeVMs, this.nodesById, this.refsByRefName);
	this.nodes(nodeVMs);
}

GitGraphViewModel.markNodesIdealogicalBranches = function(nodes, nodesById) {
	var HEAD;
	var recursivelyMarkBranch = function(e, idealogicalBranch) {
		while (e.parents.length > 0) {
			e = nodesById[e.parents[0]];
			e.idealogicalBranch = idealogicalBranch;
		}
	}
	nodes.forEach(function(e) {
		if (e.idealogicalBranch) return;
		var i = 0;
		var idealogicalBranch = e.idealogicalBranch = _.find(e.refs, function(ref) { return ref && ref != 'HEAD' && ref.indexOf('tag: ') != 0; });
		if (e.refs.indexOf('HEAD') !== -1) HEAD = e;
		if (!e.idealogicalBranch) return;
		recursivelyMarkBranch(e, idealogicalBranch);
	});
	recursivelyMarkBranch(HEAD, HEAD.idealogicalBranch);
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
	GitGraphViewModel.markNodesIdealogicalBranches(nodes, nodesById);

	var HEAD = _.find(nodes, function(node) { return node.refs.indexOf('HEAD') !== -1; });
	
	//var concurrentBranches = { };

	var updateTimeStamp = moment().valueOf();

	var branchOrder = 0;
	var y = 60; // Leave room for the "commit node" (see logrednerer.js)

	var fixRefOrder = function(ref, node) {
		if (ref.normalizeTimeStamp != updateTimeStamp) {
			ref.branchOrder = branchOrder++;
			ref.normalizeTimeStamp = updateTimeStamp;
		}
	}

	// Make sure the "ideological branch" is the leftmost
	fixRefOrder(refsByRefName[HEAD.idealogicalBranch], HEAD);

	var prevNode;
	nodes.forEach(function(node) {

		var idealogicalBranch = refsByRefName[node.idealogicalBranch];

		fixRefOrder(idealogicalBranch, node);

		node.x(30 + 60 * idealogicalBranch.branchOrder);
		if (node.idealogicalBranch == HEAD.idealogicalBranch) {
			if (prevNode && prevNode.idealogicalBranch == HEAD.idealogicalBranch)
				y += 120;
			else
				y += 60;
			node.radius(30);
			node.logBoxVisible(true);
		} else {
			y += 60;
			node.radius(15);
			node.logBoxVisible(false);
		}
		node.y(y);

		prevNode = node;
	});
}

NodeViewModel = function(args) {
	var self = this;
	this.x = ko.observable(0);
	this.y = ko.observable(0);
	this.position = ko.computed(function() {
		return new Vector2(self.x(), self.y());
	});
	this.radius = ko.observable(30);
	this.boxDisplayX = ko.computed(function() {
		return 0;
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
	this.current = false;
	this.repoPath = args.repoPath;
	this.color = GitGraphViewModel.randomColor();
}
RefViewModel.prototype.checkout = function() {
	api.query('POST', '/branch', { path: this.repoPath, name: this.name.slice('refs/heads/'.length) });
}