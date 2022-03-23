
import * as ko from 'knockout';
import * as moment from 'moment';
import { NodeViewModel, RefViewModel } from './git-elements';
import { EdgeViewModel } from './edge';
import { AbstractGraph } from './abstract-graph';
import { AbstractNodesEdges } from './abstract-nodes-edges';

export class NodesEdges extends AbstractNodesEdges {
  graph: AbstractGraph
  heighstBranchOrder = 0
  nodes = ko.observableArray<NodeViewModel>();
  viewableNodes = ko.computed(() => {
    return this.nodes().filter(node => node.isViewable());
  })
  edges = ko.observableArray<EdgeViewModel>();
  viewableEdges = ko.computed(() => {
    return this.edges().filter(edge => edge.isViewable());
  })

  constructor(graph: any) {
    super()
    this.graph = graph
  }

  processGitLog(log: any) {
    this.graph._latestNodeVersion = Date.now();
    const edges = [];

    const nodes = this._computeNode(
      (log.nodes || []).map((logEntry) => {
        const node = this.getNode(logEntry.sha1); // convert to node object
        if (!node.isInited) {
          node.setData(logEntry);
        }
        node.version = this.graph._latestNodeVersion;
        return node;
      })
    );

    // create edges
    nodes.forEach((node) => {
      node.parents().forEach((parentSha1) => {
        edges.push(this.getEdge(node.sha1, parentSha1));
      });
      node.render();
    });

    this.nodes(nodes);
    this.edges(edges);
  }

  getNode(sha1: string): NodeViewModel {
    if (!this.nodesById[sha1]) {
      this.nodesById[sha1] = new NodeViewModel(this.graph, sha1);
    }
    return this.nodesById[sha1];
  }

  _computeNode(nodes: NodeViewModel[]) {
    this._markNodesIdeologicalBranches();

    const updateTimeStamp = moment().valueOf();
    if (this.graph.HEAD()) {
      this._traverseNodeLeftParents(this.graph.HEAD(), (node) => {
        node.ancestorOfHEADTimeStamp = updateTimeStamp;
      });
    }

    // Filter out nodes which doesn't have a branch (staging and orphaned nodes)
    nodes = nodes.filter(
      (node) =>
        (node.ideologicalBranch && !node.ideologicalBranch.isStash) ||
        node.ancestorOfHEADTimeStamp === updateTimeStamp
    );

    let branchSlotCounter = this.graph.HEAD() ? 1 : 0;

    // Then iterate from the bottom to fix the orders of the branches
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.ancestorOfHEADTimeStamp === updateTimeStamp) continue;
      const ideologicalBranch = node.ideologicalBranch;

      // First occurrence of the branch, find an empty slot for the branch
      if (ideologicalBranch.lastSlottedTimeStamp !== updateTimeStamp) {
        ideologicalBranch.lastSlottedTimeStamp = updateTimeStamp;
        ideologicalBranch.branchOrder = branchSlotCounter++;
      }

      node.branchOrder(ideologicalBranch.branchOrder);
    }

    this.heighstBranchOrder = branchSlotCounter - 1;
    let prevNode: any;
    nodes.forEach((node) => {
      node.ancestorOfHEAD(node.ancestorOfHEADTimeStamp == updateTimeStamp);
      if (node.ancestorOfHEAD()) node.branchOrder(0);
      node.aboveNode = prevNode;
      if (prevNode) prevNode.belowNode = node;
      prevNode = node;
    });

    return nodes;
  }

  _markNodesIdeologicalBranches() {
    const processedNodes = new Set<NodeViewModel>();
    Object.values(this.graph.refsByRefName)
      .filter((r: RefViewModel) => !!r.node())
      .sort((a: RefViewModel, b: RefViewModel) => {
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
      }).forEach((ref: RefViewModel) => {
        this._traverseNodeParents(ref.node(), (node: NodeViewModel) => {
          if (processedNodes.has(node)) {
            return false;
          }
          processedNodes.add(node);
          node.ideologicalBranch = ref;
          return true;
        });
      });
  }

  _traverseNodeParents(node: NodeViewModel, callback: (node: NodeViewModel) => boolean) {
    if (!callback(node)) return false;
    for (let i = 0; i < node.parents().length; i++) {
      // if parent, travers parent
      const parent = this.nodesById[node.parents()[i]];
      if (parent) {
        this._traverseNodeParents(parent, callback);
      }
    }
  }

  _traverseNodeLeftParents(node: NodeViewModel, callback) {
    callback(node);
    const parent = this.nodesById[node.parents()[0]];
    if (parent) {
      this._traverseNodeLeftParents(parent, callback);
    }
  }

  getEdge(nodeAsha1: string, nodeBsha1: string) {
    const leftNode = nodeAsha1 < nodeBsha1 ? nodeAsha1 : nodeBsha1;
    const rightNode = nodeAsha1 < nodeBsha1 ? nodeBsha1 : nodeAsha1;
    const id = `${leftNode}-${rightNode}`;
    let edge = this.edgesById[id];
    if (!edge) {
      edge = this.edgesById[id] = new EdgeViewModel(this.graph, leftNode, rightNode);
    }
    return edge;
  }

  getPathToCommonAncestor(fromNode: NodeViewModel, targetNode: NodeViewModel) {
    const path = [];
    while (fromNode && !this.isAncestor(targetNode, fromNode)) {
      path.push(fromNode);
      fromNode = this.nodesById[fromNode.parents()[0]];
    }
    if (fromNode) path.push(fromNode);
    return path;
  }

  isAncestor(fromNode: NodeViewModel, targetNode: NodeViewModel) {
    if (fromNode === targetNode) return true;
    for (const v in fromNode.parents()) {
      const n = this.nodesById[fromNode.parents()[v]];
      if (n && this.isAncestor(n, targetNode)) {
        return true;
      }
    }
    return false;
  }
}
