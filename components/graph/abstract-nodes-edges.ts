import { AbstractNode } from "./abstract-node";

export abstract class AbstractNodesEdges {
  nodesById: Record<string, any> = {} // Node
  edgesById: Record<string, any> = {} // EdgeViewModel

  getNode(sha1: string): any {
    throw Error('Not yet implemented');
  }

  getPathToCommonAncestor(from: AbstractNode, to: AbstractNode): AbstractNode[] {
    throw Error('Not yet implemented');
  }
}