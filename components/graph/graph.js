const ko = require('knockout');
const _ = require('lodash');
const octicons = require('octicons');
const components = require('ungit-components');
const GitNodeViewModel = require('./git-node');
const GitRefViewModel = require('./git-ref');
const EdgeViewModel = require('./edge');
const { ComponentRoot } = require('../ComponentRoot');

components.register('graph', (args) => new GraphViewModel(args.server, args.repoPath));

class GraphViewModel extends ComponentRoot {
  constructor(server, repoPath) {
    super();
    this._isLoadNodesFromApiRunning = false;
    this.updateBranches = _.debounce(this._updateBranches, 250, this.defaultDebounceOption);
    this._markIdeologicalStamp = 0;
    this.repoPath = repoPath;
    this.skip = ko.observable(0);
    this.server = server;
    this.currentRemote = ko.observable();
    this.nodes = ko.observableArray(/** @type {GraphNode[]} */ ([]));
    this.missingNodes = /** @type {Set<GraphNode>} */ (new Set());
    this.didFetch = false;
    this.logNodes = [];
    this.edges = ko.observableArray(/** @type {GraphEdge[]} */ ([]));
    this.refs = ko.observableArray(/** @type {GraphRef[]} */ ([]));
    this.nodesById = /** @type {Map<Hash, GraphNode>} */ (new Map());
    this.refsByRefName = /** @type {Record<string, GraphRef>} */ ({});
    this.checkedOutBranch = ko.observable();
    this.checkedOutRef = ko.computed(
      () => this.checkedOutBranch() && this.refsByRefName[`refs/heads/${this.checkedOutBranch()}`]
    );
    this.HEADref = ko.observable();
    this.HEAD = ko.computed(() => (this.HEADref() ? this.HEADref().node() : undefined));
    this.HEAD.subscribe(() => this.computeNodes());
    this.commitNodeColor = ko.computed(() => (this.HEAD() ? this.HEAD().color() : '#4A4A4A'));
    this.commitNodeEdge = ko.computed(() => {
      if (!this.HEAD() || !this.HEAD().cx() || !this.HEAD().cy()) return;
      return `M 610 68 L ${this.HEAD().cx()} ${this.HEAD().cy()}`;
    });
    this.currentActionContext = ko.observable();
    this.edgesById = {};
    this.commitOpacity = ko.observable(1.0);
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

    document.addEventListener('scroll', (ev) => {
      if (window.screen.height + window.scrollY > this.minMissingY) this.fetchCommits();
    });

    this.scrolledToEnd = this.fetchCommits.bind(this);
    this.loadAhead = this.fetchCommits.bind(this);
    this.updateBranches();
    this.refs.subscribe(() => this.fetchCommits());
    this.graphWidth = ko.observable();
    this.graphHeight = ko.observable(800);
    this.searchIcon = octicons.search.toSVG({ height: 18 });
    this.plusIcon = octicons.plus.toSVG({ height: 18 });
    // For debugging, remove later
    console.log(this);
  }

  updateNode(parentElement) {
    ko.renderTemplate('graph', this, {}, parentElement);
  }

  getNode(sha1, logEntry) {
    let nodeViewModel = this.nodesById.get(sha1);
    if (!nodeViewModel) {
      nodeViewModel = new GitNodeViewModel(this, sha1);
      this.nodesById.set(sha1, nodeViewModel);
    }
    if (logEntry) nodeViewModel.setData(logEntry);
    return nodeViewModel;
  }

  getRef(ref, sha1) {
    let refViewModel = this.refsByRefName[ref];
    if (sha1) {
      if (refViewModel) {
        if (refViewModel.sha1 !== sha1) refViewModel.setSha1(sha1);
      } else {
        refViewModel = this.refsByRefName[ref] = new GitRefViewModel(ref, this, sha1);
        this.refs.push(refViewModel);
        if (refViewModel.name === 'HEAD') {
          this.HEADref(refViewModel);
        }
      }
    } else if (!refViewModel && sha1 !== false) {
      throw new Error(`Unknown ref ${ref}`);
    }
    return refViewModel;
  }

  async _fetchCommits() {
    this._isLoadNodesFromApiRunning = true;
    if (!this.didFetch) this.computeNodes();
    const numMissing = this.missingNodes.size;
    ungit.logger.debug('graph._fetchCommits() triggered, missing %d nodes', numMissing);
    if (!numMissing) return;
    const limit = 10;
    try {
      let toFetch = [...this.missingNodes.values()];
      if (this.didFetch) {
        const h = this.HEAD();
        if (h.isInited()) {
          toFetch.sort((a, b) => {
            const yA = a.cy();
            if (isNaN(yA)) return 1;
            const yB = b.cy();
            if (isNaN(yB)) return -1;
            return a.cy() - b.cy();
          });
          const minY = window.screen.height + window.scrollY;
          let pastVisibleIdx = toFetch.findIndex((n) => n.cy() > minY);
          if (pastVisibleIdx === 0) return;
          if (pastVisibleIdx === -1) pastVisibleIdx = 3;
          toFetch = toFetch.slice(0, Math.min(pastVisibleIdx, 5));
        } else {
          toFetch = [h];
        }
      }
      const commits = await this.server.getPromise('/commits', {
        path: this.repoPath(),
        limit,
        ids: toFetch
          .slice(0, 20)
          .map((n) => n.sha1)
          .join(),
      });
      for (const c of commits) {
        const node = this.getNode(c.sha1, c);
        this.missingNodes.delete(node);
      }
      this.computeNodes();
      if (!this.didFetch) this.didFetch = true;
      // Make sure we load on-screen missing commits
      const minY = window.screen.height + window.scrollY;
      for (const n of this.missingNodes.values()) {
        if (n.cy() < minY) return this._fetchCommits();
      }
    } catch (e) {
      this.server.unhandledRejection(e);
    } finally {
      // TODO add a scroll handler
      // if (window.innerHeight - this.graphHeight() > 0 && nodeSize != this.nodes().length) {
      //   this.scrolledToEnd();
      // }
      this._isLoadNodesFromApiRunning = false;
      ungit.logger.debug('graph._fetchCommits() finished');
    }
  }

  async fetchCommits() {
    if (!this._fetchP)
      this._fetchP = this._fetchCommits().finally(() => {
        // Keep loading while commits are not inited on screen
        if (window.screen.height + window.scrollY > this.minMissingY) {
          this._fetchP = null;
          this.fetchCommits();
          return;
        }

        return setTimeout(() => (this._fetchP = null), 100);
      });
    return this._fetchP;
  }

  traverseNodeLeftParents(node, callback) {
    callback(node);
    const parent = node.parents()[0];
    if (parent) {
      this.traverseNodeLeftParents(parent, callback);
    }
  }

  /**
   * Concept: put branches + side branches on slots
   * - order the refs in some way
   * - fully walk their nodes, marking ideological branches and slots
   * - this leaves a couple branches
   * - put each branch on the graph in a slot where they are clear for their entire length
   */
  computeNodes() {
    // TODO only re-run if selected branches or gotten nodes changed
    const startTs = Date.now();
    /**
     * Sorted collection of nodes
     * Sort commits by descending date
     * Note: output 0 means nodes are the same and are stored only once
     *
     * We use an array here, this is fast for 100-1000 nodes.
     * For bigger graphs we should consider one of the strategies in js-sorted-set.
     */
    const comparator = (/** @type {GraphNode} */ a, /** @type {GraphNode} */ b) => {
      if (a === b) return 0;
      if (a.sha1 === b.sha1) {
        console.log(a, b, 'are different but the same');
        return 0;
      }
      // parents always sort below, children always sort above
      // note that we don't check transitively!
      if (a.parents().includes(b)) return -1;
      if (b.parents().includes(a)) return 1;
      // Since we initialize order before inserting, this should never clash
      const orderDiff = a.order - b.order;
      // Make sure same-line commits are in walk order, ignoring date
      if (a.line === b.line) return orderDiff;
      // Otherwise order by descending date if known
      if (a.date && b.date) {
        const diff = b.date - a.date;
        // don't return 0
        if (diff) return diff;
      }
      return orderDiff;
    };
    /** @type {GraphNode[]} */
    const nodes = [];

    let maxSlot = 0;

    // Get ordered set of refs to show
    // perhaps make main branch always sort next to HEAD?
    // or always give it the same color/style
    const refs = this.refs()
      // Pick the refs to show
      // TODO allow dangling tags as roots
      .filter((r) => !r.isLocalTag && !r.isRemoteTag && !r.isStash)
      // Branch ordering
      .sort((a, b) => {
        // TODO configurable sorting: local first or not
        if (a.isLocalHEAD) return -1;
        if (b.isLocalHEAD) return 1;
        if (a.isLocal && !b.isLocal) return -1;
        if (b.isLocal && !a.isLocal) return 1;
        if (a.isBranch && !b.isBranch) return -1;
        if (b.isBranch && !a.isBranch) return 1;
        if (a.isHEAD && !b.isHEAD) return 1;
        if (!a.isHEAD && b.isHEAD) return -1;
        if (a.node() === b.node()) return 0;
        if (a.node().date && b.node().date) return b.node().date - a.node().date;
        return 0;
      });
    if (!refs.length) return;

    // Walk all nodes in straight lines, marking tops
    let nodeCount = 0;
    let lineCount = 0;
    const seen = new WeakSet();
    const tops = new WeakSet();
    /** @type {{ node: GraphNode; ref: GraphRef }[]} */
    const toWalk = [];
    for (const ref of refs) {
      const node = ref.node();
      tops.add(node);
      toWalk.push({ node, ref });
    }
    /** @type {{ start: GraphNode; stop: GraphNode }[]} */
    const lines = [];
    while (toWalk.length) {
      // eslint-disable-next-line prefer-const
      let { node, ref } = toWalk.shift();
      if (seen.has(node)) continue;

      // Walk the leftmost path to its end
      // TODO push lines on array, figure out isRoot
      lineCount++;
      const start = node;
      let stop = node;
      do {
        node.order = nodeCount++;
        node.line = lineCount;
        node.ideologicalBranch(ref);
        seen.add(node);
        if (!node.isInited()) this.missingNodes.add(node);
        const parents = node.parents();
        for (let i = parents.length - 1; i >= 0; i--) {
          const p = parents[i];
          tops.delete(p);
          // Sort missing nodes immediately below last child
          if (!p.isInited() && (!p.date || p.date >= node.date)) p.date = node.date - 1;
          // Walk extra parents later
          if (i) toWalk.unshift({ node: p, ref });
        }
        node = parents[0];
        if (node) stop = node;
      } while (node && !seen.has(node));
      lines.push({ start, stop });
    }

    // Possibly we can move unconnected branches to the top or right.
    // `start`: beginning node of a branch
    // `stop`: parent of last branch node, or terminating node of a branch
    for (const { start, stop } of lines) {
      // Find the next free slot by walking the nodes next to the line
      // If one of the parents of a node is below the branch start,
      // it counts as an occupied slot, so we start at 0.
      // While walking, we insert the nodes in their right spot
      // Afterwards, we set their slot.

      const isHeadBranch = start.ideologicalBranch().isLocalHEAD;
      // Only possible if stop is a final node
      const isOwnStop = stop.line === start.line;
      const isConnected = !tops.has(start);
      // // Special case: skip branches without loaded node, except HEAD
      // if (!isConnected && !start.isInited() && !isHeadBranch) {
      //   continue;
      // }
      // Give HEAD some room by slotting other branches from 2
      let localMaxSlot = isHeadBranch ? -1 : 1;
      let placed, prev;
      let inserting = start;
      let passedBranchTop = false;
      let i = 0;
      // First we find the place to insert the start while tracking
      // branches that will be to the left of it
      // Then we insert nodes until the stop node
      // All the while we track the maximum used slot
      while (i < nodes.length && inserting) {
        placed = nodes[i++];
        if (!passedBranchTop) {
          if (
            (isConnected ? placed.parents().includes(start) : comparator(start, placed) < 0) ||
            comparator(stop, placed) <= 0
          ) {
            // We passed our branch connection or detached head location
            // From now on, every placed node counts
            passedBranchTop = true;
            // Make room for the prev node tail
            if (prev && prev.slot() > localMaxSlot) localMaxSlot = prev.slot();
          } else {
            // See if a parent goes beyond start or stop (their dates can differ)
            for (const p of placed.parents())
              if (
                p.line < start.line &&
                p.slot() > localMaxSlot &&
                (comparator(start, p) <= 0 || comparator(stop, p) <= 0)
              )
                localMaxSlot = p.slot();
            prev = placed;
            continue;
          }
        }
        const slot = placed.slot();
        if (slot > localMaxSlot) localMaxSlot = slot;
        if (passedBranchTop) {
          // the last node must always come before its parent node so edges flow correctly
          const mustPutAll = comparator(stop, placed) <= 0;
          while (inserting && (mustPutAll || comparator(inserting, placed) < 0)) {
            // TODO insert chunks in one go, possibly faster
            if (inserting !== stop || isOwnStop) {
              nodes.splice(i - 1, 0, inserting);
              i++;
            }
            if (inserting === stop) inserting = null;
            else inserting = inserting.parents()[0];
          }
        }
      }
      // Add leftovers to the end
      while (inserting && (isOwnStop || inserting !== stop)) {
        nodes.push(inserting);
        inserting = inserting.parents()[0];
      }

      // The free slot is next to the maximum of the others, but never to the left
      // of the stop node
      localMaxSlot++;
      if (!isOwnStop && localMaxSlot < stop.slot()) localMaxSlot = stop.slot();

      // Now place the line of commits
      let node = start;
      do {
        node.slot(localMaxSlot);
        node = node.parents()[0];
      } while (node && (isOwnStop || node !== stop));

      // Keep track of graph width
      if (maxSlot < localMaxSlot) maxSlot = localMaxSlot;
    }

    /** @type {GraphNode} */
    let prevNode;
    let maxY = 0;
    let minMissingY = Number.MAX_SAFE_INTEGER;
    for (const node of nodes) {
      // Maybe it's better to store the index, to consider later
      node.aboveNode = prevNode;
      if (prevNode) prevNode.belowNode = node;
      node.render();
      const y = node.cy();
      if (maxY < y) maxY = y;
      if (!node.isInited() && y < minMissingY) minMissingY = y;
      prevNode = node;
    }
    if (prevNode) prevNode.belowNode = null;

    const edges = [];
    for (const node of nodes) {
      for (const parent of node.parents()) {
        edges.push(this.getEdge(node.sha1, parent.sha1));
      }
    }

    const calcTs = Date.now();
    this.edges(edges);
    this.nodes(nodes);

    this.graphHeight(maxY + 80);
    this.graphWidth(1000 + maxSlot * 90);
    this.minMissingY = minMissingY;
    const layoutTs = Date.now();
    console.log(
      `computeNodes: ${nodes.length} nodes, calc ${calcTs - startTs}ms, layout ${
        layoutTs - startTs
      }ms`
    );
  }

  getEdge(nodeAsha1, nodeBsha1) {
    const id = `${nodeAsha1}-${nodeBsha1}`;
    let edge = this.edgesById[id];
    if (!edge) {
      edge = this.edgesById[id] = new EdgeViewModel(this, nodeAsha1, nodeBsha1);
    }
    return edge;
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
    if (event.event == 'git-directory-changed') {
      this.updateBranches();
      // } else if (event.event == 'request-app-content-refresh') {
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
    this.fetchCommits();
  }

  // Badly named, it only updates current branch
  updateBranches() {
    if (!this._updateBranchesP)
      this._updateBranchesP = this._updateBranches().finally(() => (this._updateBranchesP = null));
    return this._updateBranchesP;
  }

  setRemoteTags(remoteTags) {
    const stamp = Date.now();

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
        const r = this.getRef(name, sha1Map[ref.name]);
        r.stamp = stamp;
      }
    });
    this.refs().forEach((ref) => {
      // tag is removed from another source
      if (ref.isRemoteTag && ref.stamp !== stamp) {
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

module.exports = GraphViewModel;
