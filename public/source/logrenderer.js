
var GitGraphViewModel = require('./git-graph').GitGraphViewModel;
var Vector2 = require('./vector2');
var RefViewModel = require('./ref.js').RefViewModel;
var _ = require('underscore');

var logRenderer = {};
module.exports = logRenderer;

logRenderer.origin = new Vector2(5, 200);

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
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.translate(logRenderer.origin.x, logRenderer.origin.y);
	context.beginPath();
	context.moveTo(endPosition.x, endPosition.y + (endPosition.y > startPosition.y ? -arrowSize : +arrowSize));
	context.lineTo(startPosition.x, startPosition.y);
	context.stroke();
	context.beginPath();
	context.setLineDash([]);
	context.translate(endPosition.x, endPosition.y);
	context.rotate(-startPosition.sub(endPosition).angleXY());
	context.moveTo(-arrowSize, arrowSize);
	context.lineTo(0, 0);
	context.lineTo(arrowSize, arrowSize);
	context.closePath();
	context.fill();
}
logRenderer.crossOverNodes = function(context, nodes) {
	nodes.forEach(function(node) {
		context.moveTo(node.x() - node.radius(), node.y() - node.radius());
		context.lineTo(node.x() + node.radius(), node.y() + node.radius());
		context.moveTo(node.x() + node.radius(), node.y() - node.radius());
		context.lineTo(node.x() - node.radius(), node.y() + node.radius());
	});
}

logRenderer.commitDefaultColor = GitGraphViewModel.randomColor();

logRenderer.render = function(element, graph) {

	var nodes = graph.nodes() || [],
		nodesById = graph.nodesById,
		refsByRefName = graph.refsByRefName;

	if (nodes && nodes.length) {
		element.height = nodes[nodes.length - 1].y() + nodes[nodes.length - 1].radius() + logRenderer.origin.y;
		var width = 0;
		nodes.forEach(function(node) {
			width = Math.max(width, node.x() + node.radius() + logRenderer.origin.x + 200);
		});
		element.width = width;
	} else {
		element.height = logRenderer.origin.y + 200;
		element.width = logRenderer.origin.x + 200;
	}

	var commitNodePosition = new Vector2(30, 30);

	var context = element.getContext("2d");
	if (!context.setLineDash) context.setLineDash = function () {}; // Firefox doesn't support this yet.
	context.clearRect(0, 0, element.width, element.height);
	context.translate(logRenderer.origin.x, logRenderer.origin.y);

	var HEAD = graph.HEAD();
	
	// Rebase
	var rebaseNodes = {}
	var rebasePath;
	if (graph.hoverGraphAction() && graph.hoverGraphAction().style == 'rebase') {
		var ref = graph.currentActionContext();
		var onto = graph.hoverGraphAction().onto();
		if (ref && onto) {
			if (onto instanceof RefViewModel) onto = onto.node();
			rebasePath = ref.node().getPathToCommonAncestor(onto);
			rebasePath.slice(0, -1).forEach(function(node) { rebaseNodes[node.sha1] = true; });
		}
	}

	// Draw lines
	context.strokeStyle = "#4A4A4A";
	context.setLineDash([]);
	context.lineWidth = 8;
	context.beginPath();
	nodes.forEach(function(node) {
		node.parents().forEach(function(parentId) {
			var parent = nodesById[parentId];
			if (parent && parent.position().length() > 0)
				logRenderer.drawLineBetweenNodes(context,
					{ position: node.position(), radius: node.radius() },
					{ position: parent.position(), radius: parent.radius() });
			else
				logRenderer.drawLineBetweenNodes(context,
					{ position: node.position(), radius: node.radius() },
					{ position: node.position().add(new Vector2(0, 10000)), radius: node.radius() });
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
	context.setLineDash([]);
	nodes.forEach(function(node) {
		if (rebaseNodes[node.sha1])
			context.fillStyle = "#bbbbbb";
		else if (node.ideologicalBranch)
			context.fillStyle = node.ideologicalBranch.color;
		else
			context.fillStyle = "#666666";
		context.beginPath();
		context.arc(node.x(), node.y(), node.radius(), 0, 2 * Math.PI);
		context.fill();
	});
	// Commit node
	context.strokeStyle = HEAD && HEAD.ideologicalBranch ? HEAD.ideologicalBranch.color : logRenderer.commitDefaultColor;
	context.setLineDash([10, 5]);
	context.lineWidth = 7;
	context.beginPath();
	context.arc(commitNodePosition.x, commitNodePosition.y, 30 - context.lineWidth / 2, 0, 2 * Math.PI);
	context.stroke();


	var arrowSize = 16;
	var xRefLineOffset = 30;
	var yRefLineOffset = 20;
	var refLineDash = [10, 5]
	context.lineWidth = 7;

	// Draw push lines
	if (graph.hoverGraphAction() && graph.hoverGraphAction().style == 'push') {
		var local = graph.currentActionContext();
		if (local) {
			var remote = local.remoteRef();
			if (remote) {
				context.setLineDash(refLineDash);
				context.strokeStyle =
				context.fillStyle =
					"rgb(61, 139, 255)";
				var yOffset = yRefLineOffset;
				if (remote.node().y() < local.node().y()) yOffset = -yOffset;
				var startPosition = new Vector2(remote.node().x() + remote.node().radius() + xRefLineOffset, remote.node().y() - yOffset);
				var endPosition = new Vector2(local.node().x() + local.node().radius() + xRefLineOffset, local.node().y() + yOffset);
				logRenderer.drawArrowLine(context, startPosition, endPosition, arrowSize);
			}
		}
	}

	// Draw reset lines
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.translate(logRenderer.origin.x, logRenderer.origin.y);
	if (graph.hoverGraphAction() && graph.hoverGraphAction().style == 'reset') {
		var local = graph.currentActionContext();
		if (local) {
			var remote = local.remoteRef();
			context.setLineDash([]);
			context.strokeStyle = "rgb(255, 129, 31)";

			context.beginPath();
			logRenderer.crossOverNodes(context, local.node().getPathToCommonAncestor(remote.node()).slice(0, -1));
			context.stroke();
		}
	}

	// Draw rebase lines
	if (graph.hoverGraphAction() && graph.hoverGraphAction().style == 'rebase') {
		var ref = graph.currentActionContext();
		var onto = graph.hoverGraphAction().onto();
		if (ref && onto) {
			if (onto instanceof RefViewModel) onto = onto.node();
			context.setLineDash([]);
			context.lineWidth = 3;
			context.strokeStyle = "#41DE3C";

			var path = rebasePath;

			context.lineWidth = 7;
			context.setLineDash([10, 5]);

			var newNodes = path.slice(0, -1).map(function(node) {
				return {
					position: new Vector2(
						onto.x() + (node.x() - _.last(path).x()),
						onto.y() + (node.y() - _.last(path).y())),
					radius: node.radius()
				};
			});
			newNodes.forEach(function(node) {
				context.beginPath();
				context.arc(node.position.x, node.position.y, node.radius - context.lineWidth / 2, 0, 2 * Math.PI);
				context.stroke();
			});

			var prevNode = { position: onto.position(), radius: onto.radius() };
			newNodes.reverse().forEach(function(node) {
				context.beginPath();
				context.setLineDash([10, 5]);
				logRenderer.drawLineBetweenNodes(context, node, prevNode);
				context.stroke();
				prevNode = node;
			});
		}
	}

	// Draw merge lines
	if (graph.hoverGraphAction() && graph.hoverGraphAction().style == 'merge') {
		var ref = graph.currentActionContext();
		var mergeWith = graph.hoverGraphAction().mergeWith();
		if (ref && mergeWith) {
			if (mergeWith instanceof RefViewModel) mergeWith = mergeWith.node();
			
			context.setLineDash([10, 5]);
			context.lineWidth = 7;
			context.strokeStyle = "#41DE3C";

			var newNode = {
				position: new Vector2(
					ref.node().x() + ref.node().radius() + ((mergeWith.x() + mergeWith.radius()) - (ref.node().x() + ref.node().radius())) / 2,
					Math.min(ref.node().y(), mergeWith.y())),
				radius: Math.max(ref.node().radius(), mergeWith.radius())
			};
			newNode.position.y -= newNode.radius*2;

			context.beginPath();
			context.arc(newNode.position.x, newNode.position.y, newNode.radius, 0, 2 * Math.PI);
			context.stroke();

			context.beginPath();
			context.setLineDash([10, 5]);
			logRenderer.drawLineBetweenNodes(context, { position: ref.node().position(), radius: ref.node().radius() }, newNode);
			logRenderer.drawLineBetweenNodes(context, { position: mergeWith.position(), radius: mergeWith.radius() }, newNode);
			context.stroke();
		}
	}
}