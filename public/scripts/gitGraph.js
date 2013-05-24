

var GitGraphViewModel = function() {
	this.nodes = ko.observable([]);
	this.refs = ko.observableArray();
	this.nodesById = {};
	this.refsByRefName = {};
}

GitGraphViewModel.prototype.setNodes = function(nodes) {
	console.log('ADD NODES', nodes.length);
	var self = this;
	var nodeVMs = [];
	nodes.forEach(function(node) {
		var nodeViewModel = new NodeViewModel(node);
		console.log('ADD NODE');
		nodeVMs.push(nodeViewModel);
		console.log('ADDED NODE');
		self.nodesById[node.sha1] = nodeViewModel;
		if (node.refs) {
			node.refs.forEach(function(ref) {
				if (!self.refsByRefName[ref]) {
					var refViewModel = self.refsByRefName[ref] = new RefViewModel({ name: ref });
					self.refs.push(refViewModel);
				}
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

	var y = 30;

	y += 120; // Leave room for the "commit node" (see logrednerer.js)
	
	var branchOrder = 0;

	nodes.forEach(function(node) {
		console.log('branchOrder', branchOrder);
		var idealogicalBranch = refsByRefName[node.idealogicalBranch];

		if (idealogicalBranch.normalizeTimeStamp != updateTimeStamp) {
			idealogicalBranch.node(node);
			idealogicalBranch.branchOrder = branchOrder++;
			idealogicalBranch.normalizeTimeStamp = updateTimeStamp;
			console.log(idealogicalBranch, updateTimeStamp);
		}

		node.x(30 + 60 * idealogicalBranch.branchOrder);
		node.y(y);

		y += 120;
	});
}

NodeViewModel = function(args) {
	var self = this;
	this.x = ko.observable(0);
	this.y = ko.observable(0);
	this.position = ko.computed(function() {
		return new Vector2(self.x(), self.y());
	});
	this.radius = 30;
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
	this.path = args.path;
	this.color = GitGraphViewModel.randomColor();
}
RefViewModel.prototype.checkout = function() {
	api.query('POST', '/branch', { path: this.path, name: this.name });
}