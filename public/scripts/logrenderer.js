

var logRenderer = {};

logRenderer.drawLineBetweenNodes = function(context, nodeA, nodeB) {
	var a = nodeA.position;
	var b = nodeB.position;
	var d = b.sub(a).normalized();
	a = a.add(d.mul(nodeA.radius + 2));
	b = b.sub(d.mul(nodeB.radius + 2));
	context.moveTo(a.x, a.y);
	context.lineTo(b.x, b.y);
}

logRenderer.render = function(element, nodes, nodesById, refsByRefName) {
	if (!nodes.length) return;

	element.height = nodes[nodes.length - 1].y() + nodes[nodes.length - 1].radius() + 2;

	var HEAD = _.find(nodes, function(node) { return _.find(node.refs(), function(r) { return r.isLocalHEAD; }); });
	var commitNodePosition = new Vector2(30, 30);
	
	var context = element.getContext("2d");
	context.clearRect(0, 0, element.width, element.height)

	// Draw lines
	context.strokeStyle = "#737373";
	context.setLineDash(undefined);
	context.lineWidth = 10;
	context.beginPath();
	nodes.forEach(function(node) {
		node.parents.forEach(function(parentId) {
			var parent = nodesById[parentId];
			logRenderer.drawLineBetweenNodes(context,
				{ position: node.position(), radius: node.radius() },
				{ position: parent.position(), radius: parent.radius() });
		});
	});
	context.stroke();
	if (HEAD) {
		context.beginPath();
		context.setLineDash([10, 5]);
		logRenderer.drawLineBetweenNodes(context,
			{ position: commitNodePosition, radius: 30 },
			{ position: HEAD.position(), radius: HEAD.radius() });
		context.stroke();
	}
	
	// Draw nodes
	context.setLineDash(undefined);
	nodes.forEach(function(node) {
		if (node.idealogicalBranch)
			context.fillStyle = node.idealogicalBranch.color;
		else
			context.fillStyle = "#666666";
		context.beginPath();
		context.arc(node.x(), node.y(), node.radius(), 0, 2 * Math.PI);
		context.fill();
	});
	if (HEAD) {
		context.strokeStyle = HEAD.idealogicalBranch.color;
		context.setLineDash([10, 5]);
		context.lineWidth = 7;
		context.beginPath();
		context.arc(commitNodePosition.x, commitNodePosition.y, 30 - context.lineWidth / 2, 0, 2 * Math.PI);
		context.stroke();
	}

}