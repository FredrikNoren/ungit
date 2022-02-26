import * as ko from 'knockout';
import { ModalViewModel, PromptOptions } from './modalBase';
declare const ungit: any;

ungit.components.register('yesnomodal', (args: any) => new YesNoModalViewModel(args.title, args.details, args.closeFunc));
ungit.components.register(
  'yesnomutemodal',
  (args: any) => new YesNoMuteModalViewModel(args.title, args.details, args.closeFunc)
);
ungit.components.register(
  'toomanyfilesmodal',
  (args: any) => new TooManyFilesModalViewModel(args.title, args.details, args.closeFunc)
);
ungit.components.register('texteditmodal', (args: any) => new TextEditModal(args.title, args.content, args.closeFunc));


/**
 * Prompt's receives decisions from users, such as 'yes' or 'no', based on 
 * button clicks.
 */
class PromptModalViewModel extends ModalViewModel {
  promptOptions: Array<PromptOptions>
  details: ko.Observable
  template: string
  closeFunc: Function
  constructor(title: string, taModalName: string, details: string, closeFunc: Function) {
    super(title, taModalName);
    this.promptOptions = [];
    this.details = ko.observable(details);
    this.template = 'promptModal';
    this.closeFunc = closeFunc;
  }

  close(isYes: boolean = false, isMute: boolean = false) {
    this.closeFunc(isYes, isMute);
    super.close();
  }

  closeYes() {
    this.close(true);
  }

  closeYesMute() {
    this.close(true, true);
  }

  closeNo() {
    this.close();
  }
}

class YesNoModalViewModel extends PromptModalViewModel {
  constructor(title: string, details: string, closeFunc: Function) {
    super(title, 'yes-no-modal', details, closeFunc);
    this.promptOptions.push(new PromptOptions('Yes', true, 'yes', this.closeYes.bind(this)));
    this.promptOptions.push(new PromptOptions('No', false, 'no', this.closeNo.bind(this)));
  }
}

class YesNoMuteModalViewModel extends PromptModalViewModel {
  constructor(title: string, details: string, closeFunc: Function) {
    super(title, 'yes-no-mute-modal', details, closeFunc);
    this.promptOptions.push(new PromptOptions('Yes', true, 'yes', this.closeYes.bind(this)));
    this.promptOptions.push(new PromptOptions('Yes and mute for awhile', false, 'mute', this.closeYesMute.bind(this)));
    this.promptOptions.push(new PromptOptions('No', false, 'no', this.closeNo.bind(this)));
  }
}

class TooManyFilesModalViewModel extends PromptModalViewModel {
  constructor(title: string, details: string, closeFunc: Function) {
    super(title, 'yes-no-modal', details, closeFunc);
    this.promptOptions.push(new PromptOptions(`Don't load`, true, 'noLoad', this.closeYes.bind(this)));
    this.promptOptions.push(new PromptOptions(`Load anyway`, false, 'loadAnyway', this.closeNo.bind(this)));
  }
}

class TextEditModal extends PromptModalViewModel {
  constructor(title: string, details: string, closeFunc: Function) {
    super(
      title,
      'text-edit-modal',
      `<textarea class="text-area-content form-control" spellcheck="false" style="height: 250px; width: 100%; font-family: monospace; resize: vertical;">${details}</textarea>`,
      closeFunc
    );
    this.promptOptions.push(new PromptOptions('Save', true, 'save', this.closeYes.bind(this)));
    this.promptOptions.push(new PromptOptions('Cancel', false, 'cancel', this.closeNo.bind(this)));
  }
}
