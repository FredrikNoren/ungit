var ko = require('knockout');
var components = require('ungit-components');
var GitNodeViewModel = require('./git-node');
var GitRefViewModel = require('./git-ref');
var _ = require('lodash');
var moment = require('moment');
var EdgeViewModel = require('./edge');
var numberOfNodesPerLoad = ungit.config.numberOfNodesPerLoad;

components.register('graph', function(args) {
  return new GraphViewModel(args.server, args.repoPath);
});

function GraphViewModel(server, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.limit = ko.observable(numberOfNodesPerLoad);
  this.skip = ko.observable(0);
  this.server = server;
  this.currentRemote = ko.observable();
  this.nodesLoader = components.create('progressBar', {
    predictionMemoryKey: 'gitgraph-' + self.repoPath(),
    fallbackPredictedTimeMs: 1000,
    temporary: true
  });
  this.nodes = ko.observableArray();
  this.edges = ko.observableArray();
  this.refs = ko.observableArray();
  this.nodesById = {};
  this.refsByRefName = {};
  this.checkedOutBranch = ko.observable();
  this.checkedOutRef = ko.computed(function() {
    return self.checkedOutBranch() ? self.getRef('refs/heads/' + self.checkedOutBranch()) : null;
  });
  this.HEADref = ko.observable();
  this.HEAD = ko.computed(function() {
    return self.HEADref() ? self.HEADref().node() : undefined;
  });
  this.commitNodeColor = ko.computed(function() {
    return self.HEAD() ? self.HEAD().color() : '#4A4A4A';
  });
  this.commitNodeEdge = ko.computed(function() {
    if (!self.HEAD() || !self.HEAD().cx() || !self.HEAD().cy()) return;
    return "M 610 68 L " + self.HEAD().cx() + " " + self.HEAD().cy();
  });
  this.showCommitNode = ko.observable(false);
  this.currentActionContext = ko.observable();
  this.edgesById = {};
  this.scrolledToEnd = _.debounce(function() {
    self.limit(numberOfNodesPerLoad + self.limit());
    self.loadNodesFromApi();
  }, 500, true);
  this.loadAhead = _.debounce(function() {
    if (self.skip() <= 0) return;
    self.skip(Math.max(self.skip() - numberOfNodesPerLoad, 0));
    self.loadNodesFromApi();
  }, 500, true);
  this.dimCommit = ko.observable(false);
  this.commitOpacity = ko.computed(function() { return self.dimCommit() ? 0.1 : 1; });
  this.heighstBranchOrder = 0;
  this.hoverGraphActionGraphic = ko.observable();
  this.hoverGraphActionGraphic.subscribe(function(value) {
    if (value && value.destroy)
      value.destroy();
  }, null, 'beforeChange');

  this.hoverGraphAction = ko.observable();
  this.hoverGraphAction.subscribe(function(value) {
    if (value && value.createHoverGraphic) {
      self.hoverGraphActionGraphic(value.createHoverGraphic());
    } else {
      self.hoverGraphActionGraphic(null);
    }
  });

  this.loadNodesFromApiThrottled = _.throttle(this.loadNodesFromApi.bind(this), 500);
  this.updateBranchesThrottled = _.throttle(this.updateBranches.bind(this), 500);
  this.loadNodesFromApiThrottled();
  this.updateBranchesThrottled();
  this.graphWidth = ko.observable();
  this.graphHeight = ko.observable(800);
}

GraphViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('graph', this, {}, parentElement);
}

GraphViewModel.prototype.getNode = function(sha1, logEntry) {
  var nodeViewModel = this.nodesById[sha1];
  if (!nodeViewModel) nodeViewModel = this.nodesById[sha1] = new GitNodeViewModel(this, sha1);
  if (logEntry) nodeViewModel.setData(logEntry);
  return nodeViewModel;
}
GraphViewModel.prototype.getRef = function(ref, constructIfUnavailable) {
  if (constructIfUnavailable === undefined) constructIfUnavailable = true;
  var refViewModel = this.refsByRefName[ref];
  if (!refViewModel && constructIfUnavailable) {
    refViewModel = this.refsByRefName[ref] = new GitRefViewModel(ref, this);
    this.refs.push(refViewModel);
    if (refViewModel.name === 'HEAD') {
      this.HEADref(refViewModel);
    }
  }
  return refViewModel;
}

GraphViewModel.prototype.loadNodesFromApi = function(callback) {
  var self = this;

  this.nodesLoader.start();
  this.server.getPromise('/log', { path: this.repoPath(), limit: this.limit(), skip: this.skip() })
    .then(function(log) {
      var nodes = log.nodes ? log.nodes : [];
      self.limit(parseInt(log.limit));
      self.skip(parseInt(log.skip));
      nodes = self.computeNode(nodes.map(function(logEntry) {
          return self.getNode(logEntry.sha1, logEntry);
        }));

      var edges = [];
      nodes.forEach(function(node) {
        node.parents().forEach(function(parentSha1) {
          edges.push(self.getEdge(node.sha1, parentSha1));
        });
        node.render();
      });

      self.edges(edges);
      self.nodes(nodes);

      if (nodes.length > 0) {
        self.graphHeight(nodes[nodes.length - 1].cy() + 80);
      }
      self.graphWidth(1000 + (self.heighstBranchOrder * 90));
    }).finally(function() {
      self.nodesLoader.stop();
      if (callback) callback();
    });
}

GraphViewModel.prototype.traverseNodeLeftParents = function(node, callback) {
  callback(node);
  var parent = this.nodesById[node.parents()[0]];
  if (parent) {
    this.traverseNodeLeftParents(parent, callback);
  }
}

GraphViewModel.prototype.computeNode = function(nodes) {
  var self = this;

  if (!nodes) {
    nodes = this.nodes();
  }

  this.markNodesIdeologicalBranches(this.refs(), nodes, this.nodesById);

  var updateTimeStamp = moment().valueOf();
  if (this.HEAD()) {
    this.traverseNodeLeftParents(this.HEAD(), function(node) {
      node.ancestorOfHEADTimeStamp = updateTimeStamp;
    });
  }

  // Filter out nodes which doesn't have a branch (staging and orphaned nodes)
  nodes = nodes.filter(function(node) { return (node.ideologicalBranch() && !node.ideologicalBranch().isStash) || node.ancestorOfHEADTimeStamp == updateTimeStamp; })

  var branchSlots = [];

  // Then iterate from the bottom to fix the orders of the branches
  for (var i = nodes.length - 1; i >= 0; i--) {
    var node = nodes[i];
    if (node.ancestorOfHEADTimeStamp == updateTimeStamp) continue;
    var ideologicalBranch = node.ideologicalBranch();

    // First occurence of the branch, find an empty slot for the branch
    if (ideologicalBranch.lastSlottedTimeStamp != updateTimeStamp) {
      ideologicalBranch.lastSlottedTimeStamp = updateTimeStamp;
      var slot = branchSlots.indexOf(undefined);
      if (slot === -1) {
        branchSlots.push(ideologicalBranch);
        slot = branchSlots.length - 1;
      }
      ideologicalBranch.branchOrder = slot;
      branchSlots[slot] = slot;
    }

    node.branchOrder(ideologicalBranch.branchOrder);
    self.heighstBranchOrder = Math.max(self.heighstBranchOrder, node.branchOrder());
  }

  var prevNode;
  nodes.forEach(function(node) {
    node.branchOrder(branchSlots.length - node.branchOrder());
    node.ancestorOfHEAD(node.ancestorOfHEADTimeStamp == updateTimeStamp);
    node.aboveNode = prevNode;
    if (prevNode) prevNode.belowNode = node;
    prevNode = node;
  });

  return nodes;
}

GraphViewModel.prototype.getEdge = function(nodeAsha1, nodeBsha1) {
  var id = nodeAsha1 + '-' + nodeBsha1;
  var edge = this.edgesById[id];
  if (!edge) {
    edge = this.edgesById[id] = new EdgeViewModel(this, nodeAsha1, nodeBsha1);
  }
  return edge;
}

GraphViewModel._markIdeologicalStamp = 0;
GraphViewModel.prototype.markNodesIdeologicalBranches = function(refs, nodes, nodesById) {
  var self = this;
  refs = refs.filter(function(r) { return !!r.node(); });
  refs = refs.sort(function(a, b) {
    if (a.isLocal && !b.isLocal) return -1;
    if (b.isLocal && !a.isLocal) return 1;
    if (a.isBranch && !b.isBranch) return -1;
    if (b.isBranch && !a.isBranch) return 1;
    if (a.isHEAD && !b.isHEAD) return 1;
    if (!a.isHEAD && b.isHEAD) return -1;
    if (a.isStash && !b.isStash) return 1;
    if (b.isStash && !a.isStash) return -1;
    if (a.node() && a.node().date && b.node() && b.node().date)
      return a.node().date - b.node().date;
    return a.refName < b.refName ? -1 : 1;
  });
  var stamp = GraphViewModel._markIdeologicalStamp++;
  refs.forEach(function(ref) {
    self.traverseNodeParents(ref.node(), function(node) {
      if (node.stamp == stamp) return false;
      node.stamp = stamp;
      node.ideologicalBranch(ref);
      return true;
    });
  });
}

GraphViewModel.prototype.traverseNodeParents = function(node, callback) {
  if (!callback(node)) return false;
  for (var i = 0; i < node.parents().length; i++) {
    // if parent, travers parent
    var parent = this.nodesById[node.parents()[i]];
    if (parent) {
      this.traverseNodeParents(parent, callback);
    }
  }
}

GraphViewModel.prototype.handleBubbledClick = function(elem, event) {
  // If the clicked element is bound to the current action context,
  // then let's not deselect it.
  if (ko.dataFor(event.target) === this.currentActionContext()) return;
  if (this.currentActionContext() && this.currentActionContext() instanceof GitNodeViewModel) {
    this.currentActionContext().toggleSelected();
  } else {
    this.currentActionContext(null);
  }
  // If the click was on an input element, then let's allow the default action to proceed.
  // This is especially needed since for some strange reason any submit (ie. enter in a textbox)
  // will trigger a click event on the submit input of the form, which will end up here,
  // and if we don't return true, then the submit event is never fired, breaking stuff.
  if (event.target.nodeName === 'INPUT') return true;
}

GraphViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'git-directory-changed') {
    this.loadNodesFromApiThrottled();
    this.updateBranchesThrottled();
  } else if (event.event == 'request-app-content-refresh') {
    this.loadNodesFromApiThrottled();
  } else if (event.event == 'remote-tags-update') {
    this.setRemoteTags(event.tags);
  } else if (event.event == 'current-remote-changed') {
    this.currentRemote(event.newRemote);
  } else if (event.event == 'graph-render') {
    this.nodes().forEach(function(node) {
      node.render();
    });
  }
}
GraphViewModel.prototype.updateBranches = function() {
  var self = this;
  this.server.get('/checkout', { path: this.repoPath() }, function(err, branch) {
    if (err && err.errorCode == 'not-a-repository') return true;
    if (err) return;
    self.checkedOutBranch(branch);
  });
}
GraphViewModel.prototype.setRemoteTags = function(remoteTags) {
  var self = this;
  var nodeIdsToRemoteTags = {};
  remoteTags.forEach(function(ref) {
    if (ref.name.indexOf('^{}') != -1) {
      var tagRef = ref.name.slice(0, ref.name.length - '^{}'.length);
      var name = 'remote-tag: ' + ref.remote + '/' + tagRef.split('/')[2];
      self.getRef(name).node(self.getNode(ref.sha1));
    }
  });
}
GraphViewModel.prototype.checkHeadMove = function(toNode) {
  if (this.HEAD() === toNode) {
    this.HEADref.node(toNode);
  }
}
