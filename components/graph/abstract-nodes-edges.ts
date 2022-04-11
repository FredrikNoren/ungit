import { AbstractNode } from "./abstract-node";

export abstract class AbstractNodesEdges {
  nodesById: Record<string, any> = {} // Node
  edgesById: Record<string, any> = {} // EdgeViewModel

  abstract getNode(sha1: string): any
  abstract getPathToCommonAncestor(from: AbstractNode, to: AbstractNode): AbstractNode[]
}