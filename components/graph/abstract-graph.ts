import * as ko from 'knockout';
import { AbstractNodesEdges } from "./abstract-nodes-edges"

export abstract class AbstractGraph {
  currentActionContext: ko.Observable<any> // Node | Ref | undefined
  repoPath: ko.Observable<string>
  server: any
  HEAD: ko.Computed<any> // Node | undefined
  refs: ko.ObservableArray<any> // Ref
  _latestNodeVersion: number

  nodesEdges: AbstractNodesEdges

  commitOpacity(opacity: number) {
    throw Error('Not yet implemented');
  }
  getRef(sha1: string): any {// Node
    throw Error('Not yet implemented');
  }
}