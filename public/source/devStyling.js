// Used for styles.html (development styling file)

var ko = require('../vendor/js/knockout-2.2.1');
var GraphViewModel = require('./graph-graphics/graph').GraphViewModel;
var NodeViewModel = require('./graph-graphics/node').NodeViewModel;
var EdgeViewModel = require('./graph-graphics/edge').EdgeViewModel;
var Vector2 = require('./vector2');
var RebaseHoverGraphic = require('./graph-graphics/rebase').RebaseHoverGraphic;
var MergeViewModel = require('./graph-graphics/merge').MergeViewModel;

var viewModel = {};

function normal() {
	var graph = new GraphViewModel();
	graph.nodes([
		new NodeViewModel(new Vector2(50, 50), 30),
		new NodeViewModel(new Vector2(50, 150), 30),
		new NodeViewModel(new Vector2(50, 250), 30),
	]);
	graph.edges([
		new EdgeViewModel(graph.nodes()[0], graph.nodes()[1]),
		new EdgeViewModel(graph.nodes()[1], graph.nodes()[2])
	]);
	return graph;
}

function rebase() {
	var graph = new GraphViewModel();
	graph.offset(new Vector2(0, 100));
	graph.nodes([
		new NodeViewModel(new Vector2(50, 50), 30),
		new NodeViewModel(new Vector2(50, 150), 30),
		new NodeViewModel(new Vector2(150, 50), 30),
	]);
	graph.edges([
		new EdgeViewModel(graph.nodes()[0], graph.nodes()[1]),
		new EdgeViewModel(graph.nodes()[1], graph.nodes()[2])
	]);
	graph.hoverGraphActionGraphic(new RebaseHoverGraphic(graph.nodes()[2], [graph.nodes()[0], graph.nodes()[1]]))
	return graph;
}

function merge() {
	var graph = new GraphViewModel();
	graph.offset(new Vector2(0, 100));
	graph.nodes([
		new NodeViewModel(new Vector2(50, 50), 30),
		new NodeViewModel(new Vector2(50, 150), 30),
		new NodeViewModel(new Vector2(150, 50), 15),
	]);
	graph.edges([
		new EdgeViewModel(graph.nodes()[0], graph.nodes()[1]),
		new EdgeViewModel(graph.nodes()[1], graph.nodes()[2])
	]);
	graph.hoverGraphActionGraphic(new MergeViewModel(graph.nodes()[0], graph.nodes()[2]))
	return graph;
}

viewModel.graphGraphicsSamples = {};
viewModel.graphGraphicsSamples.normal = normal();
viewModel.graphGraphicsSamples.rebase = rebase();
viewModel.graphGraphicsSamples.merge = merge();

ko.applyBindings(viewModel);