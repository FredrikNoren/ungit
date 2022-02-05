declare const ungit: any;

export class ModalViewModel {
  title: string
  taModalName: string
  timestamp = new Date().getTime()
  constructor(title: string, taModalName: string) {
    this.title = title;
    this.taModalName = taModalName;
  }

  close() {
    ungit.programEvents.dispatch({ event: 'modal-close-dialog', modal: this });
  }
}

export class FormItems {
  name: string
  value: ko.Observable
  type: string
  autoFocus: boolean
  constructor(name: string, value: ko.Observable, type: string, autoFocus: boolean) {
    this.name = name;
    this.value = value;
    this.type = type;
    this.autoFocus = autoFocus;
  }
}

export class PromptOptions {
  label: string
  primary: boolean
  taId: string
  close: Function

  constructor(label: string, primary: boolean, taId: string, close: Function) {
    this.label = label;
    this.primary = primary;
    this.taId = taId;
    this.close = close;
  }
}
