

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

	console.log('RENDER', nodes.length);

	var HEAD = _.find(nodes, function(node) { return node.refs.indexOf('HEAD') != -1; });
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
		context.fillStyle = refsByRefName[node.idealogicalBranch].color;
		context.beginPath();
		context.arc(node.x(), node.y(), node.radius(), 0, 2 * Math.PI);
		context.fill();
	});
	if (HEAD) {
		context.strokeStyle = refsByRefName[HEAD.idealogicalBranch].color;
		context.setLineDash([10, 5]);
		context.lineWidth = 7;
		context.beginPath();
		context.arc(commitNodePosition.x, commitNodePosition.y, 30 - context.lineWidth / 2, 0, 2 * Math.PI);
		context.stroke();
	}

}