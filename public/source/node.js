
NodeViewModel = function(graph, sha1) {
	var self = this;

	this.graph = graph;
	this.sha1 = sha1;

	this.position = ko.observable(new Vector2(0, 0));
	this.goalPosition = ko.observable();
	this.isAtFinalXPosition = ko.computed(function() {
		if (!self.goalPosition()) return true;
		return self.position().x == self.goalPosition().x;
	});
	this.x = ko.computed(function() { return self.position().x; });
	this.y = ko.computed(function() { return self.position().y; });
	this.radius = ko.observable(30);
	this.goalRadius = ko.observable();
	this.boxDisplayX = ko.computed(function() {
		return self.x();
	});
	this.boxDisplayY = ko.computed(function() {
		return self.y();
	});
	this.logBoxX = ko.computed(function() {
		return -self.radius();
	})
	this.refsX = ko.computed(function() {
		return self.radius();
	});
	this.nodeX = ko.computed(function() {
		return -self.radius();
	});
	this.nodeY = ko.computed(function() {
		return -self.radius();
	});
	this.nodeWidth = ko.computed(function() {
		return self.radius()*2;
	});
	this.nodeHeight = ko.computed(function() {
		return self.radius()*2;
	});

	this.commitTime = ko.observable();
	this.authorTime = ko.observable();
	this.parents = ko.observable([]);
	this.message = ko.observable();
	this.title = ko.observable();
	this.body = ko.observable();
	this.authorDate = ko.observable(0);
	this.authorDateFromNow = ko.observable();
	this.authorName = ko.observable();
	this.authorEmail = ko.observable();
	this.authorGravatar = ko.computed(function() { return CryptoJS.MD5(self.authorEmail()); });

	this.index = ko.observable();
	this.ancestorOfHEAD = ko.observable(false);
	this.nodeIsMousehover = ko.observable(false);
	this.logBoxVisible = ko.computed(function() {
		return (self.ancestorOfHEAD() && self.isAtFinalXPosition()) || self.nodeIsMousehover();
	});
	// These are split up like this because branches and local tags can be found in the git log,
	// whereas remote tags needs to be fetched with another command (which is much slower)
	this.branchesAndLocalTags = ko.observable([]);
	this.remoteTags = ko.observable([]);
	this.refs = ko.computed(function() {
		var rs = self.branchesAndLocalTags().concat(self.remoteTags());
		rs.sort(function(a, b) {
			if (a.isLocal && !b.isLocal) return -1;
			if (!a.isLocal && b.isLocal) return 1;
			return a.displayName < b.displayName ? -1 : 1;
		});
		return rs;
	});
	this.branches = ko.computed(function() {
		return self.refs().filter(function(r) { return r.isBranch; });
	});
	this.tags = ko.computed(function() {
		return self.refs().filter(function(r) { return r.isTag; });
	});
	this.newBranchName = ko.observable();
	this.newBranchNameHasFocus = ko.observable(true);
	this.newBranchNameHasFocus.subscribe(function(newValue) {
		if (!newValue) {
			// Small timeout because in ff the form is hidden before the submit click event is registered otherwise
			setTimeout(function() {
				self.branchingFormVisible(false);
			}, 200);
		}
	})
	this.branchingFormVisible = ko.observable(false);
	this.canCreateRef = ko.computed(function() {
		return self.newBranchName() && self.newBranchName().trim();
	})

	this.dropareaGraphActions = [
		new GraphActions.Move(this.graph, this),
		new GraphActions.Rebase(this.graph, this),
		new GraphActions.Merge(this.graph, this),
		new GraphActions.Push(this.graph, this),
		new GraphActions.Reset(this.graph, this),
		new GraphActions.Pull(this.graph, this),
		new GraphActions.Checkout(this.graph, this),
		new GraphActions.Delete(this.graph, this),
	];
}
if (typeof exports !== 'undefined') exports.NodeViewModel = NodeViewModel;
NodeViewModel.prototype.setData = function(args) {
	this.commitTime(moment(args.commitDate));
	this.authorTime(moment(args.authorDate));
	this.parents(args.parents || []);
	var message = args.message.split('\n');
	this.message(args.message);
	this.title(message[0]);
	this.body(message.slice(2).join('\n'));
	this.authorDate(moment(args.authorDate));
	this.authorDateFromNow(this.authorDate().fromNow());
	this.authorName(args.authorName);
	this.authorEmail(args.authorEmail);
}
NodeViewModel.prototype.setPosition = function(position) {
	var self = this;
	this.prevPosition = self.position();
	if (!self.goalPosition()) self.position(position);
	self.goalPosition(position);
}
NodeViewModel.prototype.setRadius = function(radius) {
	this.prevRadius = this.radius();
	if (!this.goalRadius()) this.radius(radius);
	this.goalRadius(radius);
	this.setRadiusTimestamp = Date.now();
}
NodeViewModel.prototype.updateLastAuthorDateFromNow = function(deltaT) {
	this.lastUpdatedAuthorDateFromNow = this.lastUpdatedAuthorDateFromNow || 0;
	this.lastUpdatedAuthorDateFromNow += deltaT;
	if(this.lastUpdatedAuthorDateFromNow > 60 * 1000) {
		this.lastUpdatedAuthorDateFromNow = 0;
		this.authorDateFromNow(this.authorDate().fromNow());
	}
}
NodeViewModel.prototype.updateAnimationFrame = function(deltaT) {
	this.updateLastAuthorDateFromNow(deltaT);

	var totalTime = 500;

	var d = this.goalPosition().sub(this.position());
	var distanceLeft = d.length();
	if (distanceLeft != 0) {

		d = this.goalPosition().sub(this.prevPosition);

		var totalLength = d.length();
		var lengthToMove = deltaT * 0.4;
		if (distanceLeft < lengthToMove) {
			this.position(this.goalPosition());
		} else {
			d = d.normalized().mul(lengthToMove);

			var pos = this.position().add(d);
			this.position(pos);
		}
	}

	var radiusLeft = this.goalRadius() - this.radius();
	if (radiusLeft != 0) {
		var sign = radiusLeft ? radiusLeft < 0 ? -1 : 1 : 0;
		radiusLeft = Math.abs(radiusLeft);
		var totalRadiusDiff = Math.abs(this.goalRadius() - this.prevRadius);
		var radiusToChange = totalRadiusDiff * deltaT / totalTime;
		if (radiusLeft < radiusToChange) {
			this.radius(this.goalRadius());
		} else {
			this.radius(this.radius() + sign * radiusToChange);
		}
	}
}
NodeViewModel.prototype.showBranchingForm = function() {
	this.branchingFormVisible(true);
	this.newBranchNameHasFocus(true);
}
NodeViewModel.prototype.createBranch = function() {
	if (!this.canCreateRef()) return;
	api.query('POST', '/branches', { path: this.graph.repoPath, name: this.newBranchName(), startPoint: this.sha1 });
	this.branchingFormVisible(false);
	this.newBranchName('');
}
NodeViewModel.prototype.createTag = function() {
	if (!this.canCreateRef()) return;
	api.query('POST', '/tags', { path: this.graph.repoPath, name: this.newBranchName(), startPoint: this.sha1 });
	this.branchingFormVisible(false);
	this.newBranchName('');
}
NodeViewModel.prototype.isAncestor = function(node) {
	if (this.index() >= this.graph.maxNNodes) return false;
	if (node == this) return true;
	for (var v in this.parents()) {
		var n = this.graph.nodesById[this.parents()[v]];
		if (n && n.isAncestor(node)) return true;
	}
	return false;
}
NodeViewModel.prototype.getPathToCommonAncestor = function(node) {
	var path = [];
	var thisNode = this;
	while (thisNode && !node.isAncestor(thisNode)) {
		path.push(thisNode);
		thisNode = this.graph.nodesById[thisNode.parents()[0]];
	}
	if (thisNode)
		path.push(thisNode);
	return path;
}
NodeViewModel.prototype.nodeMouseover = function() {
	this.nodeIsMousehover(true);
}
NodeViewModel.prototype.nodeMouseout = function() {
	this.nodeIsMousehover(false);
}

