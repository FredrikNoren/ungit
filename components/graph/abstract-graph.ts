import * as ko from 'knockout';
import { AbstractNodesEdges } from "./abstract-nodes-edges"

export abstract class AbstractGraph {
  currentActionContext: ko.Observable<any> // Node | Ref | undefined
  repoPath: ko.Observable<string>
  server: any
  HEAD: ko.Computed<any> // Node | undefined
  HEADref: ko.Observable<any> // Ref | undefined
  refs: ko.ObservableArray<any> // Ref
  _latestNodeVersion: number
  checkedOutBranch: ko.Observable<string>
  currentRemote: ko.Observable<string>
  refsByRefName: Record<string, any> // Ref

  nodesEdges: AbstractNodesEdges

  commitOpacity(opacity: number) {
    throw Error('Not yet implemented');
  }
  getRef(sha1: string, constructIfUnavailable: boolean | undefined = undefined): any { // Node
    throw Error('Not yet implemented');
  }
}