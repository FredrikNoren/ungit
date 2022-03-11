import * as ko from 'knockout';
import { ComponentRoot } from '../ComponentRoot';
import { AbstractNodesEdges } from "./abstract-nodes-edges"

export abstract class AbstractGraph extends ComponentRoot {
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
  commitOpacity: ko.Observable<number>

  nodesEdges: AbstractNodesEdges

  abstract getRef(sha1: string, constructIfUnavailable: boolean | undefined): any // Ref
}