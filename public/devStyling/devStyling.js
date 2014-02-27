// Used for devStyling.html (development styling file)

var ko = require('knockout');
var GraphViewModel = require('./../../components/graph/graph-graphics/graph').GraphViewModel;
var NodeViewModel = require('./../../components/graph/graph-graphics/node').NodeViewModel;
var EdgeViewModel = require('./../../components/graph/graph-graphics/edge').EdgeViewModel;
var Vector2 = require('../../source/utils/vector2');
var graphGraphicsActions = require('./../../components/graph/graph-graphics/actions');

var viewModel = {};

function normal() {
  var graph = new GraphViewModel();
  graph.nodes([
    new NodeViewModel(new Vector2(50, 50), 30),
    new NodeViewModel(new Vector2(50, 150), 30),
    new NodeViewModel(new Vector2(50, 250), 30),
  ]);
  graph.nodes()[0].selected(true);
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
  graph.hoverGraphActionGraphic(new graphGraphicsActions.RebaseViewModel(graph.nodes()[2], [graph.nodes()[0], graph.nodes()[1]]))
  return graph;
}

function merge() {
  var graph = new GraphViewModel();
  graph.showCommitNode(true);
  graph.offset(new Vector2(0, 100));
  graph.nodes([
    new NodeViewModel(new Vector2(30, 150), 30),
    new NodeViewModel(new Vector2(30, 250), 30),
    new NodeViewModel(new Vector2(150, 150), 15),
  ]);
  graph.edges([
    new EdgeViewModel(graph.nodes()[0], graph.nodes()[1]),
    new EdgeViewModel(graph.nodes()[1], graph.nodes()[2])
  ]);
  graph.commitNodeEdge.nodeb(graph.nodes()[0]);
  graph.commitNodeEdge.updateAnimationFrame()
  graph.hoverGraphActionGraphic(new graphGraphicsActions.MergeViewModel(graph, graph.nodes()[0], graph.nodes()[2]))
  return graph;
}

function reset() {
  var graph = new GraphViewModel();
  graph.nodes([
    new NodeViewModel(new Vector2(50, 50), 30),
    new NodeViewModel(new Vector2(50, 150), 30)
  ]);
  graph.edges([
    new EdgeViewModel(graph.nodes()[0], graph.nodes()[1])
  ]);
  graph.hoverGraphActionGraphic(new graphGraphicsActions.ResetViewModel([graph.nodes()[0]]))
  return graph;
}

function push() {
  var graph = new GraphViewModel();
  graph.nodes([
    new NodeViewModel(new Vector2(50, 50), 30),
    new NodeViewModel(new Vector2(50, 150), 30)
  ]);
  graph.edges([
    new EdgeViewModel(graph.nodes()[0], graph.nodes()[1])
  ]);
  graph.hoverGraphActionGraphic(new graphGraphicsActions.PushViewModel(graph.nodes()[1], graph.nodes()[0]))
  return graph;
}

viewModel.graphGraphicsSamples = {};
viewModel.graphGraphicsSamples.normal = normal();
viewModel.graphGraphicsSamples.rebase = rebase();
viewModel.graphGraphicsSamples.merge = merge();
viewModel.graphGraphicsSamples.reset = reset();
viewModel.graphGraphicsSamples.push = push();

ko.applyBindings(viewModel);