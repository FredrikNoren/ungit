import * as ko from 'knockout';
declare const ungit: any;

ungit.components.register(
  'credentialsmodal',
  (args: any) => new CredentialsModalViewModel(args.remote)
);
ungit.components.register('addremotemodal', () => new AddRemoteModalViewModel());
ungit.components.register('addsubmodulemodal', () => new AddSubmoduleModalViewModel());

class FormItems {
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

class ModalViewModel {
  title: string
  taModalName: string
  constructor(title: string) {
    this.title = title;
    this.taModalName = '';
  }

  close() {
    ungit.programEvents.dispatch({ event: 'modal-close-dialog', modal: this });
  }
}

class FormModalViewModel extends ModalViewModel {
  items: Array<FormItems>
  showCancel: boolean
  template: string
  constructor(title: string, showCancel: boolean) {
    super(title);
    this.items = [];
    this.showCancel = showCancel;
    this.template = 'formModal';
  }

  submit() {
    ungit.programEvents.dispatch({ event: 'modal-close-dialog', modal: this, submit: true });
  }
}

class CredentialsModalViewModel extends FormModalViewModel {
  username: ko.Observable
  password: ko.Observable
  constructor(remote: string) {
    super(`Remote ${remote} requires authentication`, false);
    this.taModalName = 'credentials-dialog';
    this.username = ko.observable();
    this.password = ko.observable();
    this.items.push(new FormItems('Username', this.username, 'text', true))
    this.items.push(new FormItems('Password', this.password, 'password', false))
  }
}

class AddRemoteModalViewModel extends FormModalViewModel {
  name: ko.Observable
  url: ko.Observable
  constructor() {
    super('Add new remote', true);
    this.taModalName = 'add-remote';
    this.name = ko.observable();
    this.url = ko.observable();
    this.items.push(new FormItems('Name', this.name, 'text', true))
    this.items.push(new FormItems('Url', this.url, 'text', false))
  }
}

class AddSubmoduleModalViewModel extends FormModalViewModel {
  path: ko.Observable
  url: ko.Observable
  constructor() {
    super('Add new submodule', true);
    this.taModalName = 'add-submodule';
    this.path = ko.observable();
    this.url = ko.observable();
    this.items.push(new FormItems('Path', this.path, 'text', true))
    this.items.push(new FormItems('Url', this.url, 'text', false))
  }
}
