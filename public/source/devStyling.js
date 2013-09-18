// Used for styles.html (development styling file)

var ko = require('../vendor/js/knockout-2.2.1');
var GraphViewModel = require('./graph-graphics/graph').GraphViewModel;
var NodeViewModel = require('./graph-graphics/node').NodeViewModel;
var EdgeViewModel = require('./graph-graphics/edge').EdgeViewModel;
var Vector2 = require('./vector2');

var viewModel = {};

viewModel.graphGraphicsSamples = {};
var normal = new GraphViewModel();
viewModel.graphGraphicsSamples.normal = normal;
normal.nodes([
	new NodeViewModel(new Vector2(0, 0), 30),
	new NodeViewModel(new Vector2(0, 80), 30),
	new NodeViewModel(new Vector2(0, 160), 30),
]);
normal.edges([
	new EdgeViewModel(normal.nodes()[0], normal.nodes()[1]),
	new EdgeViewModel(normal.nodes()[1], normal.nodes()[2])
]);

ko.applyBindings(viewModel);