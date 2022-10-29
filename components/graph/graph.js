const ko = require('knockout');
const _ = require('lodash');
const moment = require('moment');
const octicons = require('octicons');
const components = require('ungit-components');
const GitNodeViewModel = require('./git-node');
const GitRefViewModel = require('./git-ref');
const EdgeViewModel = require('./edge');
const { ComponentRoot } = require('../ComponentRoot');
const numberOfNodesPerLoad = ungit.config.numberOfNodesPerLoad;

components.register('graph', (args) => new GraphViewModel(args.server, args.repoPath));

class GraphViewModel extends ComponentRoot {
  constructor(server, repoPath) {
    super();
    this._isLoadNodesFromApiRunning = false;
    this.updateBranches = _.debounce(this._updateBranches, 250, this.defaultDebounceOption);
    this.loadNodesFromApi = _.debounce(this._loadNodesFromApi, 250, this.defaultDebounceOption);
    this._markIdeologicalStamp = 0;
    this.repoPath = repoPath;
    this.limit = ko.observable(numberOfNodesPerLoad);
    this.skip = ko.observable(0);
    this.server = server;
    this.currentRemote = ko.observable();
    this.nodes = ko.observableArray();
    this.edges = ko.observableArray();
    this.refs = ko.observableArray();
    this.nodesById = {};
    this.edgesById = {};
    this.refsByRefName = {};
    this.checkedOutBranch = ko.observable();
    this.checkedOutRef = ko.computed(() =>
      this.checkedOutBranch() ? this.getRef(`refs/heads/${this.checkedOutBranch()}`) : null
    );
    this.HEADref = ko.observable();
    this.HEAD = ko.computed(() => (this.HEADref() ? this.HEADref().node() : undefined));
    this.commitNodeColor = ko.computed(() => (this.HEAD() ? this.HEAD().color() : '#4A4A4A'));
    this.commitNodeEdge = ko.computed(() => {
      if (!this.HEAD() || !this.HEAD().cx() || !this.HEAD().cy()) return;
      return `M 610 68 L ${this.HEAD().cx()} ${this.HEAD().cy()}`;
    });
    this.currentActionContext = ko.observable();
    this.scrolledToEnd = _.debounce(
      () => {
        this.limit(numberOfNodesPerLoad + this.limit());
        this.loadNodesFromApi();
      },
      500,
      true
    );
    this.loadAhead = _.debounce(
      () => {
        if (this.skip() <= 0) return;
        this.skip(Math.max(this.skip() - numberOfNodesPerLoad, 0));
        this.loadNodesFromApi();
      },
      500,
      true
    );
    this.commitOpacity = ko.observable(1.0);
    this.heighstBranchOrder = 0;
    this.hoverGraphActionGraphic = ko.observable();
    this.hoverGraphActionGraphic.subscribe(
      (value) => {
        if (value && value.destroy) value.destroy();
      },
      null,
      'beforeChange'
    );

    this.hoverGraphAction = ko.observable();
    this.hoverGraphAction.subscribe((value) => {
      if (value && value.createHoverGraphic) {
        this.hoverGraphActionGraphic(value.createHoverGraphic());
      } else {
        this.hoverGraphActionGraphic(null);
      }
    });

    this.loadNodesFromApi();
    this.updateBranches();
    this.graphWidth = ko.observable();
    this.graphHeight = ko.observable(800);
    this.searchIcon = octicons.search.toSVG({ height: 18 });
    this.plusIcon = octicons.plus.toSVG({ height: 18 });
  }

  updateNode(parentElement) {
    ko.renderTemplate('graph', this, {}, parentElement);
  }

  getNode(sha1, logEntry) {
    let nodeViewModel = this.nodesById[sha1];
    if (!nodeViewModel) nodeViewModel = this.nodesById[sha1] = new GitNodeViewModel(this, sha1);
    if (logEntry) nodeViewModel.setData(logEntry);
    return nodeViewModel;
  }

  getRef(ref, constructIfUnavailable) {
    if (constructIfUnavailable === undefined) constructIfUnavailable = true;
    let refViewModel = this.refsByRefName[ref];
    if (!refViewModel && constructIfUnavailable) {
      refViewModel = this.refsByRefName[ref] = new GitRefViewModel(ref, this);
      this.refs.push(refViewModel);
      if (refViewModel.name === 'HEAD') {
        this.HEADref(refViewModel);
      }
    }
    return refViewModel;
  }

  async _loadNodesFromApi() {
    this._isLoadNodesFromApiRunning = true;
    ungit.logger.debug('graph.loadNodesFromApi() triggered');
    const nodeSize = this.nodes().length;
    const edges = [];

    try {
      const log = await this.server.getPromise('/gitlog', {
        path: this.repoPath(),
        limit: this.limit(),
        skip: this.skip(),
      });
      if (this.isSamePayload(log)) {
        return;
      }
      const nodes = this.computeNode(
        (log.nodes || []).map((logEntry) => {
          return this.getNode(logEntry.sha1, logEntry); // convert to node object
        })
      );

      // create edges
      nodes.forEach((node) => {
        node.parents().forEach((parentSha1) => {
          edges.push(this.getEdge(node.sha1, parentSha1));
        });
        node.render();
      });

      this.edges(edges);
      this.nodes(nodes);
      if (nodes.length > 0) {
        this.graphHeight(nodes[nodes.length - 1].cy() + 80);
      }
      this.graphWidth(1000 + this.heighstBranchOrder * 90);
    } catch (e) {
      this.server.unhandledRejection(e);
    } finally {
      if (window.innerHeight - this.graphHeight() > 0 && nodeSize != this.nodes().length) {
        this.scrolledToEnd();
      }
      this._isLoadNodesFromApiRunning = false;
      ungit.logger.debug('graph.loadNodesFromApi() finished');
    }
  }

  traverseNodeLeftParents(node, callback) {
    callback(node);
    const parent = this.nodesById[node.parents()[0]];
    if (parent) {
      this.traverseNodeLeftParents(parent, callback);
    }
  }

  computeNode(nodes) {
    this.markNodesIdeologicalBranches(this.refs());

    const updateTimeStamp = moment().valueOf();
    if (this.HEAD()) {
      this.traverseNodeLeftParents(this.HEAD(), (node) => {
        node.ancestorOfHEADTimeStamp = updateTimeStamp;
      });
    }

    // Filter out nodes which doesn't have a branch (staging and orphaned nodes)
    nodes = nodes.filter(
      (node) =>
        (node.ideologicalBranch() && !node.ideologicalBranch().isStash) ||
        node.ancestorOfHEADTimeStamp == updateTimeStamp
    );

    let branchSlotCounter = this.HEAD() ? 1 : 0;

    // Then iterate from the bottom to fix the orders of the branches
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.ancestorOfHEADTimeStamp == updateTimeStamp) continue;
      const ideologicalBranch = node.ideologicalBranch();

      // First occurrence of the branch, find an empty slot for the branch
      if (ideologicalBranch.lastSlottedTimeStamp != updateTimeStamp) {
        ideologicalBranch.lastSlottedTimeStamp = updateTimeStamp;
        ideologicalBranch.branchOrder = branchSlotCounter++;
      }

      node.branchOrder(ideologicalBranch.branchOrder);
    }

    this.heighstBranchOrder = branchSlotCounter - 1;
    let prevNode;
    nodes.forEach((node) => {
      node.ancestorOfHEAD(node.ancestorOfHEADTimeStamp == updateTimeStamp);
      if (node.ancestorOfHEAD()) node.branchOrder(0);
      node.aboveNode = prevNode;
      if (prevNode) prevNode.belowNode = node;
      prevNode = node;
    });

    return nodes;
  }

  getEdge(nodeAsha1, nodeBsha1) {
    const id = `${nodeAsha1}-${nodeBsha1}`;
    let edge = this.edgesById[id];
    if (!edge) {
      edge = this.edgesById[id] = new EdgeViewModel(this, nodeAsha1, nodeBsha1);
    }
    return edge;
  }

  markNodesIdeologicalBranches(refs) {
    refs = refs.filter((r) => !!r.node());
    refs = refs.sort((a, b) => {
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
    const stamp = this._markIdeologicalStamp++;
    refs.forEach((ref) => {
      this.traverseNodeParents(ref.node(), (node) => {
        if (node.stamp == stamp) return false;
        node.stamp = stamp;
        node.ideologicalBranch(ref);
        return true;
      });
    });
  }

  traverseNodeParents(node, callback) {
    if (!callback(node)) return false;
    for (let i = 0; i < node.parents().length; i++) {
      // if parent, travers parent
      const parent = this.nodesById[node.parents()[i]];
      if (parent) {
        this.traverseNodeParents(parent, callback);
      }
    }
  }

  handleBubbledClick(elem, event) {
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

  onProgramEvent(event) {
    if (event.event == 'git-directory-changed' || event.event === 'working-tree-changed') {
      this.loadNodesFromApi();
      this.updateBranches();
    } else if (event.event == 'request-app-content-refresh') {
      this.loadNodesFromApi();
    } else if (event.event == 'remote-tags-update') {
      this.setRemoteTags(event.tags);
    } else if (event.event == 'current-remote-changed') {
      this.currentRemote(event.newRemote);
    } else if (event.event == 'graph-render') {
      this.nodes().forEach((node) => {
        node.render();
      });
    }
  }

  updateAnimationFrame(deltaT) {
    this.nodes().forEach((node) => {
      node.updateAnimationFrame(deltaT);
    });
  }

  async _updateBranches() {
    const checkout = await this.server.getPromise('/checkout', { path: this.repoPath() });

    try {
      ungit.logger.debug('setting checkedOutBranch', checkout);
      this.checkedOutBranch(checkout);
    } catch (err) {
      if (err.errorCode != 'not-a-repository') {
        this.server.unhandledRejection(err);
      } else {
        ungit.logger.warn('updateBranches failed', err);
      }
    }
  }

  setRemoteTags(remoteTags) {
    const version = Date.now();

    const sha1Map = {}; // map holding true sha1 per tags
    remoteTags.forEach((tag) => {
      if (tag.name.includes('^{}')) {
        // This tag is a dereference tag, use this sha1.
        const tagRef = tag.name.slice(0, tag.name.length - '^{}'.length);
        sha1Map[tagRef] = tag.sha1;
      } else if (!sha1Map[tag.name]) {
        // If sha1 wasn't previously set, use this sha1
        sha1Map[tag.name] = tag.sha1;
      }
    });

    remoteTags.forEach((ref) => {
      if (!ref.name.includes('^{}')) {
        const name = `remote-tag: ${ref.remote}/${ref.name.split('/')[2]}`;
        this.getRef(name).node(this.getNode(sha1Map[ref.name]));
        this.getRef(name).version = version;
      }
    });
    this.refs().forEach((ref) => {
      // tag is removed from another source
      if (ref.isRemoteTag && (!ref.version || ref.version < version)) {
        ref.remove(true);
      }
    });
  }

  checkHeadMove(toNode) {
    if (this.HEAD() === toNode) {
      this.HEADref().node(toNode);
    }
  }
}
