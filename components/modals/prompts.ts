import * as ko from 'knockout';
import { ModalViewModel, PromptOptions } from './modalBase';
declare const ungit: any;

ungit.components.register('yesnomodal', (args: any) => new YesNoModalViewModel(args.title, args.details, args.yesFunc));
ungit.components.register(
  'yesnomutemodal',
  (args: any) => new YesNoMuteModalViewModel(args.title, args.details, args.yesFunc)
);
ungit.components.register(
  'toomanyfilesmodal',
  (args: any) => new TooManyFilesModalViewModel(args.title, args.details, args.yesFunc)
);
ungit.components.register('texteditmodal', (args: any) => new TextEditModal(args.title, args.content, args.yesFunc));


/**
 * Prompt's receives decisions from users, such as 'yes' or 'no', based on 
 * button clicks.
 */
class PromptModalViewModel extends ModalViewModel {
  promptOptions: Array<PromptOptions>
  details: ko.Observable
  template: string
  yesFunc: Function
  constructor(title: string, taModalName: string, details: string, yesFunc: Function) {
    super(title, taModalName);
    this.promptOptions = [];
    this.details = ko.observable(details);
    this.template = 'prompt';
    this.yesFunc = yesFunc;
  }

  closePrompt(isYes: boolean = undefined, isMute: boolean = undefined) {
    if (isMute) {
      ungit.programEvents.dispatch({ event: 'modal-mute' });
    }
    if (isYes) {
      this.yesFunc();
    }
    super.close();
  }
}

class YesNoModalViewModel extends PromptModalViewModel {
  constructor(title: string, details: string, yesFunc: Function) {
    super(title, 'yes-no-moda', details, yesFunc);
    this.promptOptions.push(new PromptOptions('Yes', true, 'yes', () => { this.closePrompt(true) }));
    this.promptOptions.push(new PromptOptions('No', false, 'no', () => { this.closePrompt() }));
  }
}

class YesNoMuteModalViewModel extends PromptModalViewModel {
  constructor(title: string, details: string, yesFunc: Function) {
    super(title, 'yes-no-mute-Modal', details, yesFunc);
    this.promptOptions.push(new PromptOptions('Yes', true, 'yes', () => { this.closePrompt(true) }));
    this.promptOptions.push(new PromptOptions('Yes and mute for awhile', false, 'mute', () => { this.closePrompt(true, true) }));
    this.promptOptions.push(new PromptOptions('No', false, 'no', () => { this.closePrompt() }));
  }
}

class TooManyFilesModalViewModel extends PromptModalViewModel {
  constructor(title: string, details: string, yesFunc: Function) {
    super(title, 'yes-no-Modal', details, yesFunc);
    this.promptOptions.push(new PromptOptions(`Don't load`, true, 'noLoad', () => { this.closePrompt() }));
    this.promptOptions.push(new PromptOptions(`Load anyway`, false, 'loadAnyway', () => { this.closePrompt(true) }));
  }
}

class TextEditModal extends PromptModalViewModel {
  textValue: string
  constructor(title: string, details: string, yesFunc: Function) {
    super(
      title,
      'text-edit-Modal',
      `<textarea class="text-area-content form-control" spellcheck="false" style="height: 250px; width: 100%; font-family: monospace; resize: vertical;">${details}</textarea>`,
      yesFunc
    );
    this.promptOptions.push(new PromptOptions('Save', true, 'save', () => {
      this.textValue = (document.querySelector('.modal-body .text-area-content') as HTMLInputElement).value;
      this.closePrompt(true);
    }));
    this.promptOptions.push(new PromptOptions('Cancel', false, 'cancel', () => { this.closePrompt() }));
  }
}
