import * as ko from 'knockout';
import { Animateable } from './animateable';
import { RefViewModel } from './git-elements';

export abstract class AbstractNode extends Animateable {
  sha1: string
  refs = ko.observableArray<RefViewModel>().extend({
    rateLimit: { timeout: 250, method: 'notifyWhenChangesStop' }
  });
  version: number | undefined;
  isInited: boolean
  date: undefined | number = undefined; // commit time in numeric format for sort

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

  abstract getLeftToRightStrike(): string
  abstract getRightToLeftStrike(): string
}