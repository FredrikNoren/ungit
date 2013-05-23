

var logRenderer = {};

var Vector2 = function(x, y) {
	this.x = x;
	this.y = y;
}
Vector2.prototype.length = function() {
	return Math.sqrt(this.x * this.x + this.y * this.y);
}
Vector2.prototype.normalized = function() {
	var length = this.length();
	return new Vector2(this.x / length, this.y / length);
}
Vector2.prototype.sub = function(v) {
	return Vector2.sub(this, v);
}
Vector2.prototype.add = function(v) {
	return Vector2.add(this, v);
}
Vector2.prototype.mul = function(v) {
	return Vector2.mul(this, v);
}
Vector2.sub = function(a, b) {
	return new Vector2(a.x - b.x, a.y - b.y);
}
Vector2.add = function(a, b) {
	return new Vector2(a.x + b.x, a.y + b.y);
}
Vector2.mul = function(a, val) {
	return new Vector2(a.x * val, a.y * val);
}

var LogNodeIcon = function(logEntry) {
	this.logEntry = logEntry;
	this.position = new Vector2();
	this.radius = 30;
}
LogNodeIcon.prototype.draw = function(context) {
	context.fillStyle = this.branch.color;
	context.setLineDash(undefined);
	context.beginPath();
	context.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
	context.fill();

	context.fillStyle = "#C9C9C9";
	context.font = "bold 16px Arial";
	context.fillText(this.branch.name, this.position.x + this.radius + 10, this.position.y);
}

var CommitNode = function(x, y) {
	this.position = new Vector2(x, y);
	this.radius = 30;
}
CommitNode.prototype.draw = function(context) {
	context.strokeStyle = this.branch.color;
	context.setLineDash([10, 5]);
	context.lineWidth = 7;
	context.beginPath();
	context.arc(this.position.x, this.position.y, this.radius - context.lineWidth/2, 0, 2 * Math.PI);
	context.stroke();

	context.fillStyle = "#C9C9C9";
	context.font = "bold 16px Arial";
	context.fillText('Commit', this.position.x + this.radius + 10, this.position.y);
}

var LogEdge = function(node1, node2) {
	this.node1 = node1;
	this.node2 = node2;
}
LogEdge.prototype.draw = function(context) {
	context.strokeStyle = "#737373";
	context.setLineDash(undefined);
	context.lineWidth = 10;
	context.beginPath();
	var a = this.node1.position;
	var b = this.node2.position;
	var d = b.sub(a).normalized();
	a = a.add(d.mul(this.node1.radius + 2));
	b = b.sub(d.mul(this.node1.radius + 2));
	context.moveTo(a.x, a.y);
	context.lineTo(b.x, b.y);
	context.stroke();
}

var getLogGraph = function(log) {
	var logGraph = {};
	log.forEach(function(entry) {
		logGraph[entry.sha1] = entry;
	});
	return logGraph;
}

var markBranches = function(log, logGraph) {
	log.forEach(function(e) {
		if (e.branch) return;
		var i = 0;
		var branch = e.branch = _.find(e.refs, function(ref) { return ref && ref != 'HEAD' && ref.indexOf('tag: ') != 0; });
		if (!e.branch) return;
		while (e.parents.length > 0) {
			e = logGraph[e.parents[0]];
			if (e.branch) return;
			e.branch = branch;
		}
	});
}

var splitIntoBranches = function(log) {


	log.forEach(function(entry) {
		getBranch()
	});
}

var randomColor = function() {
	var randomHex = function() {
		var r = Math.floor(Math.random() * 256).toString(16);
		if (r.length == 1) r = '0' + r;
		return r;
	}
	return '#' + randomHex() + randomHex() + randomHex();
}

var buildSceneGraph = function(log) {

	if (log.length == 0) return [];

	var HEAD;
	log.forEach(function(entry) {
		entry.time = moment(entry.date);
		entry.refs = entry.refs || [];
		entry.parents = entry.parents || [];
		if (entry.refs.indexOf('HEAD') >= 0) HEAD = entry;
	});
	log.sort(function(a, b) { return a.time.unix() < b.time.unix(); });

	var logGraph = getLogGraph(log);

	markBranches(log, logGraph);

	var sceneGraph = [];

	var branches = {};

	var getBranch = function(name, entry) {
		var branch = branches[name];
		if (!branch) branch = branches[name] = {
			name: name,
			order: Object.keys(branches).length,
			color: randomColor(),
			topCommit: entry
		};
		return branch;
	}

	var y = 30;

	var commitNode = new CommitNode(30, y);
	sceneGraph.push(commitNode);

	y += 120;

	log.forEach(function(entry) {
		var logNodeIcon = new LogNodeIcon(entry);
		sceneGraph.push(logNodeIcon);

		var branch = getBranch(entry.branch, entry);
		logNodeIcon.branch = branch;

		logNodeIcon.position.x = 30 + 60 * branch.order;
		logNodeIcon.position.y = y;

		entry.graphNode = logNodeIcon;

		y += 120;
	});

	log.forEach(function(entry) {
		entry.parents.forEach(function(parent) {
			sceneGraph.push(new LogEdge(entry.graphNode, logGraph[parent].graphNode));
		});
	});

	sceneGraph.push(new LogEdge(commitNode, HEAD.graphNode));

	commitNode.branch = HEAD.graphNode.branch;

	return sceneGraph;	
}

logRenderer.render = function(log, element) {
	
	var context = element.getContext("2d");
	context.clearRect(0, 0, element.width, element.height)

	var sceneGraph = buildSceneGraph(log);
	sceneGraph.forEach(function(node) {
		console.log('Drawing ', node);
		node.draw(context);
	});
	
}