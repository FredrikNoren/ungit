

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
logRenderer.drawArrowLine = function(context, startPosition, endPosition, arrowSize) {
	context.beginPath();
	context.moveTo(endPosition.x, endPosition.y);
	context.lineTo(startPosition.x, startPosition.y);
	context.stroke();
	context.beginPath();
	context.setLineDash(undefined);
	context.translate(endPosition.x, endPosition.y);
	context.rotate(startPosition.sub(endPosition).angleXY());
	context.moveTo(-arrowSize, arrowSize);
	context.lineTo(0, 0);
	context.lineTo(arrowSize, arrowSize);
	context.stroke();
}

logRenderer.render = function(element, graph) {

	var nodes = graph.nodes(),
		nodesById = graph.nodesById,
		refsByRefName = graph.refsByRefName;

	if (!nodes.length) return;

	element.height = nodes[nodes.length - 1].y() + nodes[nodes.length - 1].radius() + 2;

	var HEAD = GitGraphViewModel.getHEAD(nodes);
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

	var arrowSize = 7;
	var xRefLineOffset = 30;
	var yRefLineOffset = 20;
	var refLineDash = [10, 5]
	context.lineWidth = 3;

	// Draw push lines
	var pushRef = graph.pushHover();
	if (pushRef) {
		var remote = pushRef.remoteRef();
		context.setLineDash(refLineDash);
		context.strokeStyle = "rgb(61, 139, 255)";
		var endPosition = new Vector2(pushRef.node().x() + pushRef.node().radius() + xRefLineOffset, pushRef.node().y() + yRefLineOffset);
		var startPosition = new Vector2(remote.node().x() + remote.node().radius() + xRefLineOffset, remote.node().y() - yRefLineOffset);
		logRenderer.drawArrowLine(context, startPosition, endPosition, arrowSize);
	}

	// Draw reset lines
	var resetRef = graph.resetHover();
	if (resetRef) {
		var remote = resetRef.remoteRef();
		context.setLineDash(refLineDash);
		context.strokeStyle = "rgb(255, 129, 31)";
		var endPosition = new Vector2(remote.node().x() + remote.node().radius() + xRefLineOffset, remote.node().y() - yRefLineOffset);
		var startPosition = new Vector2(resetRef.node().x() + resetRef.node().radius() + xRefLineOffset, resetRef.node().y() + yRefLineOffset);
		logRenderer.drawArrowLine(context, startPosition, endPosition, arrowSize);
	}
}