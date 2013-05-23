

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

var LogNodeIcon = function() {
	this.position = new Vector2();
	this.radius = 30;
}
LogNodeIcon.prototype.draw = function(context) {
	context.fillStyle = "#F2361D";
	context.beginPath();
	context.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
	context.fill();
}

var LogEdge = function(node1, node2) {
	this.node1 = node1;
	this.node2 = node2;
}
LogEdge.prototype.draw = function(context) {
	context.fillStyle = "#F2361D";
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
	log.forEach(function(entry) { logGraph[entry.sha1] = entry });
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

var buildSceneGraph = function(log) {

	log.forEach(function(entry) {
		entry.time = moment(entry.date);
		entry.refs = entry.refs || [];
		entry.parents = entry.parents || [];
	});
	log.sort(function(a, b) { return a.time.unix() < b.time.unix(); });

	var logGraph = getLogGraph(log);

	markBranches(log, logGraph);

	var sceneGraph = [];

	var branches = {};

	var getBranch = function(name) {
		var branch = branches[name];
		if (!branch) branch = branches[name] = { order: Object.keys(branches).length };
		return branch;
	}

	var y = 30;

	log.forEach(function(entry) {
		var logNodeIcon = new LogNodeIcon();
		sceneGraph.push(logNodeIcon);

		var branch = getBranch(entry.branch);

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

	return sceneGraph;	
}

logRenderer.render = function(log, element) {
	
	var context = element.getContext("2d");

	var sceneGraph = buildSceneGraph(log);
	sceneGraph.forEach(function(node) {
		node.draw(context);
	});
	
}