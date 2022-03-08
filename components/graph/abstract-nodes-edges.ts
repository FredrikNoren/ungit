import { AbstractNode } from "./abstract-node";

export abstract class AbstractNodesEdges {
  getPathToCommonAncestor(from: AbstractNode, to: AbstractNode): AbstractNode[] {
    throw Error('Not yet implemented');
  }
}