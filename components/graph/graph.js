

var ko = require('knockout');
var Vector2 = require('ungit-vector2');
var GitNodeViewModel = require('./git-node').GitNodeViewModel;
var RefViewModel = require('./ref.js').RefViewModel;
var components = require('ungit-components');
var moment = require('moment');
var _ = require('lodash');
var GraphViewModel = require('./graph-graphics/graph').GraphViewModel;
var EdgeViewModel = require('./graph-graphics/edge').EdgeViewModel;

components.register('graph', function(args) {
  return new GitGraphViewModel(args.server, args.repoPath);
});

var GitGraphViewModel = function(server, repoPath) {
  var self = this;
  this.server = server;
  this.repoPath = repoPath;
  this.currentRemote = ko.observable();
  this.maxNNodes = 25;
  this.nodes = ko.observable([]);
  this.edgesById = {};
  this.refs = ko.observableArray();
  this.nodesById = {};
  this.refsByRefName = {};
  this.nodesLoader = components.create('progressBar', {
      predictionMemoryKey: 'gitgraph-' + self.repoPath,
      fallbackPredictedTimeMs: 1000,
      temporary: true
    });
  this.checkedOutBranch = ko.observable();
  this.checkedOutRef = ko.computed(function() {
    if (self.checkedOutBranch())
      return self.getRef('refs/heads/' + self.checkedOutBranch());
    else
      return null;
  });
  this.HEAD = ko.observable();
  this.hoverGraphAction = ko.observable();
  this.currentActionContext = ko.observable();
  this.scrolledToEnd = _.debounce(function() {
    self.maxNNodes = self.maxNNodes + 25;
    self.loadNodesFromApi();
  }, 1000, true);
  this.graphic = new GraphViewModel();
  this.graphic.offset(new Vector2(5, 200));
  this.HEAD.subscribe(function(value) {
    self.graphic.commitNodeEdge.nodeb(value);
    self.graphic.showCommitNode(!!value);
    if (value)
      self.graphic.commitNode.color(value.color());
  });

  this.nodes.subscribe(function(nodes) {
    var edges = [];
    nodes.forEach(function(node) {
      node.parents().forEach(function(parentSha1) {
        edges.push(self.getEdge(node.sha1, parentSha1));
      });
    });
    self.graphic.nodes(nodes);
    self.graphic.edges(edges);
  });

  this.hoverGraphAction.subscribe(function(value) {
    if (value) {
      if (value.createHoverGraphic)
        self.graphic.hoverGraphActionGraphic(value.createHoverGraphic());
    } else {
      self.graphic.hoverGraphActionGraphic(null);
    }
  });

  this.loadNodesFromApiThrottled = _.throttle(this.loadNodesFromApi.bind(this), 500);
  this.updateBranchesThrottled = _.throttle(this.updateBranches.bind(this), 500);
  this.loadNodesFromApiThrottled();
  this.updateBranchesThrottled();
}
GitGraphViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('graph', this, {}, parentElement);
}
exports.GitGraphViewModel = GitGraphViewModel;
GitGraphViewModel.prototype.updateAnimationFrame = function(deltaT) {
  this.graphic.updateAnimationFrame(deltaT);
}
GitGraphViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'git-directory-changed') {
    this.loadNodesFromApiThrottled();
    this.updateBranchesThrottled();
  } else if (event.event == 'request-app-content-refresh') {
    this.loadNodesFromApiThrottled();
  } else if (event.event == 'remote-tags-update') {
    this.setRemoteTags(event.tags);
  } else if (event.event == 'current-remote-changed') {
    this.currentRemote(event.newRemote);
  }
}
GitGraphViewModel.prototype.loadNodesFromApi = function(callback) {
  var self = this;
  this.nodesLoader.start();
  this.server.get('/log', { path: this.repoPath, limit: this.maxNNodes }, function(err, logEntries) {
    if (err) {
      self.nodesLoader.stop();
      if (callback) callback();
      return err.errorCode == 'no-such-path';
    }
    self.setNodesFromLog(logEntries);
    self.nodesLoader.stop();
    if (callback) callback();
  });
}
GitGraphViewModel.prototype.updateBranches = function() {
  var self = this;
  this.server.get('/checkout', { path: this.repoPath }, function(err, branch) {
    if (err && err.errorCode == 'not-a-repository') return true;
    if (err) return;
    self.checkedOutBranch(branch);
  });
}

GitGraphViewModel.prototype.setRemoteTags = function(remoteTags) {
  var self = this;
  var nodeIdsToRemoteTags = {};
  remoteTags.forEach(function(ref) {
    if (ref.name.indexOf('^{}') != -1) {
      var tagRef = ref.name.slice(0, ref.name.length - '^{}'.length);
      var name = 'remote-tag: ' + ref.remote + '/' + tagRef.split('/')[2];
      var refViewModel = self.getRef(name);
      var node = self.getNode(ref.sha1);
      refViewModel.node(node);

      nodeIdsToRemoteTags[ref.sha1] = nodeIdsToRemoteTags[ref.sha1] || [];
      nodeIdsToRemoteTags[ref.sha1].push(refViewModel);
    }
  });

  for(var key in this.nodesById)
    this.nodesById[key].remoteTags(nodeIdsToRemoteTags[key] || []);
}

GitGraphViewModel.prototype.setNodesFromLog = function(nodesData) {
  var self = this;
  var nodeVMs = [];
  nodesData.forEach(function(nodeData) {
    var nodeViewModel = self.getNode(nodeData.sha1);
    // Only set the data for the node once (since nodes never change)
    if (!nodeViewModel.isInited) nodeViewModel.setData(nodeData);
    nodeVMs.push(nodeViewModel);
    if (nodeData.refs) {
      var refVMs = nodeData.refs.map(function(ref) {
        var refViewModel = self.getRef(ref);
        refViewModel.node(nodeViewModel);
        return refViewModel;
      });
      nodeViewModel.branchesAndLocalTags(refVMs);
    }
  });
  this.setNodes(nodeVMs);
}
GitGraphViewModel.prototype.getNode = function(sha1) {
  var nodeViewModel = this.nodesById[sha1];
  if (!nodeViewModel) nodeViewModel = this.nodesById[sha1] = new GitNodeViewModel(this, sha1);
  return nodeViewModel;
}
GitGraphViewModel.prototype.getRef = function(fullRefName, constructIfUnavailable) {
  if (constructIfUnavailable === undefined) constructIfUnavailable = true;
  var refViewModel = this.refsByRefName[fullRefName];
  if (!refViewModel && constructIfUnavailable) {
    refViewModel = this.refsByRefName[fullRefName] = new RefViewModel({ name: fullRefName, graph: this });
    this.refs.push(refViewModel);
  }
  return refViewModel;
}
GitGraphViewModel.prototype.getEdge = function(nodeAsha1, nodeBsha1) {
  var id = nodeAsha1 + '-' + nodeBsha1;
  var edge = this.edgesById[id];
  if (!edge) {
    edge = this.edgesById[id] = new EdgeViewModel(this.getNode(nodeAsha1), this.getNode(nodeBsha1));
  }
  return edge;
}

GitGraphViewModel.getHEAD = function(nodes) {
  return _.find(nodes, function(node) { return _.find(node.refs(), 'isLocalHEAD'); });
}

GitGraphViewModel.traverseNodeParents = function(node, nodesById, callback) {
  if (node.index() >= this.maxNNodes) return false;
  if (!callback(node)) return false;
  for (var i=0; i < node.parents().length; i++) {
    var parent = nodesById[node.parents()[i]];
    if (parent)
      GitGraphViewModel.traverseNodeParents(parent, nodesById, callback);
  }
}
GitGraphViewModel.traverseNodeLeftParents = function(node, nodesById, callback) {
  if (node.index() >= this.maxNNodes) return;
  callback(node);
  var parent = nodesById[node.parents()[0]];
  if (parent)
    GitGraphViewModel.traverseNodeLeftParents(parent, nodesById, callback);
}

GitGraphViewModel._markIdeologicalStamp = 0;
GitGraphViewModel.markNodesIdeologicalBranches = function(refs, nodes, nodesById) {
  refs = refs.filter(function(r) { return !!r.node(); });
  refs = refs.sort(function(a, b) {
    if (a.isLocal && !b.isLocal) return -1;
    if (b.isLocal && !a.isLocal) return 1;
    if (a.isBranch && !b.isBranch) return -1;
    if (b.isBranch && !a.isBranch) return 1;
    if (a.isHead && !b.isHead) return 1;
    if (!a.isHead && b.isHead) return -1;
    if (a.isStash && !b.isStash) return 1;
    if (b.isStash && !a.isStash) return -1;
    if (a.node() && a.node().commitTime() && b.node() && b.node().commitTime())
      return a.node().commitTime().unix() - b.node().commitTime().unix();
    return a.refName < b.refName ? -1 : 1;
  });
  var stamp = GitGraphViewModel._markIdeologicalStamp++;
  refs.forEach(function(ref) {
    GitGraphViewModel.traverseNodeParents(ref.node(), nodesById, function(node) {
      if (node.stamp == stamp) return false;
      node.stamp = stamp;
      node.ideologicalBranch(ref);
      return true;
    });
  });
}

GitGraphViewModel.randomColor = function() {
  var randomHex = function() {
    var r = Math.floor(Math.random() * 256).toString(16);
    if (r.length == 1) r = '0' + r;
    return r;
  }
  return '#' + randomHex() + randomHex() + randomHex();
}


GitGraphViewModel.prototype.setNodes = function(nodes) {
  nodes.forEach(function(node, i) { node.index(i); });
  nodes = nodes.slice(0, GitGraphViewModel.maxNNodes);

  GitGraphViewModel.markNodesIdeologicalBranches(this.refs(), nodes, this.nodesById);
  this.HEAD(GitGraphViewModel.getHEAD(nodes));
  var HEAD = this.HEAD();

  var updateTimeStamp = moment().valueOf();

  // Mark timestamps
  if (HEAD) {
    GitGraphViewModel.traverseNodeLeftParents(HEAD, this.nodesById, function(node) {
      node.ancestorOfHEADTimeStamp = updateTimeStamp;
    });
  }

  // Filter out nodes which doesn't have a branch (staging and orphaned nodes)
  nodes = nodes.filter(function(node) { return (node.ideologicalBranch() && !node.ideologicalBranch().isStash) || node.ancestorOfHEADTimeStamp == updateTimeStamp; })

  //var concurrentBranches = { };

  var branchSlots = [];
  var y = 30; // Leave room for the "commit node" (see logrednerer.js)

  // Then iterate from the bottom to fix the orders of the branches
  for (var i = nodes.length - 1; i >= 0; i--) {
    var node = nodes[i];
    if (node.ancestorOfHEADTimeStamp == updateTimeStamp) continue;
    var ideologicalBranch = node.ideologicalBranch();

    // First occurence of the branch, find an empty slot for the branch
    if (ideologicalBranch.lastSlottedTimeStamp != updateTimeStamp) {
      ideologicalBranch.lastSlottedTimeStamp = updateTimeStamp;
      var slot = 0;
      for(;slot < branchSlots.length; slot++)
        if (branchSlots[slot] === undefined) break;
      if (slot == branchSlots.length) {
        branchSlots.push(ideologicalBranch);
        slot = branchSlots.length - 1;
      }
      ideologicalBranch.branchOrder = slot;
      branchSlots[slot] = slot;
    }

    node.branchOrder = ideologicalBranch.branchOrder;

    // Free branch slots when we reach the end of a branch
    /*if (node == ideologicalBranch.node()) {
      branchSlots[ideologicalBranch.branchOrder] = undefined;
    }*/
  }

  var prevNode;
  nodes.forEach(function(node) {
    var goalPosition = new Vector2();
    if (node.ancestorOfHEADTimeStamp == updateTimeStamp) {
      if (!prevNode)
        y += 90;
      else if (prevNode.ancestorOfHEADTimeStamp == updateTimeStamp)
        y += 120;
      else
        y += 60;
      goalPosition.x = 30;
      node.setRadius(30);
      node.ancestorOfHEAD(true);
    } else {
      y += 60;
      goalPosition.x = 30 + 90 * (branchSlots.length - node.branchOrder);
      node.setRadius(15);
      node.ancestorOfHEAD(false);
    }
    goalPosition.y = y;
    node.setPosition(goalPosition);

    prevNode = node;
  });

  this.nodes(nodes);
}

GitGraphViewModel.prototype.handleBubbledClick = function(elem, event) {
  // If the clicked element is bound to the current action context,
  // then let's not deselect it.
  if (ko.dataFor(event.target) === this.currentActionContext()) return;
  this.currentActionContext(null);
  // If the click was on an input element, then let's allow the default action to proceed.
  // This is especially needed since for some strange reason any submit (ie. enter in a textbox)
  // will trigger a click event on the submit input of the form, which will end up here,
  // and if we don't return true, then the submit event is never fired, breaking stuff.
  if (event.target.nodeName === 'INPUT') return true;
}
