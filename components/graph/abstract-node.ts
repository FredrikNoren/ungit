import * as ko from 'knockout';
import { Animateable } from './animateable';
import { RefViewModel } from './git-elements';

export abstract class AbstractNode extends Animateable {
  sha1: string
  refs: ko.Computed<RefViewModel[]>
  version: number | undefined;
  isInited: boolean

  aboveNode: AbstractNode = undefined;
  belowNode: AbstractNode = undefined;
  r: ko.Observable<number>
  cx: ko.Observable<number>
  cy: ko.Observable<number>

  commitComponent: any
  ancestorOfHEAD = ko.observable(false);
  isEdgeHighlighted = ko.observable(false);

  isViewable() {
    return this.version === this.graph._latestNodeVersion;
  }

  getLeftToRightStrike(): string {
    throw Error('Not yet implemented');
  }
  getRightToLeftStrike(): string {
    throw Error('Not yet implemented');
  }
}