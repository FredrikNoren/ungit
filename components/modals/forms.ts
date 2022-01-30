import * as ko from 'knockout';
import { ModalViewModel, FormItems } from './modalBase';
declare const ungit: any;

ungit.components.register(
  'credentialsmodal',
  (args: any) => new CredentialsModalViewModel(args.remote)
);
ungit.components.register('addremotemodal', (arg: any) => new AddRemoteModalViewModel(arg.repoPath));
ungit.components.register('addsubmodulemodal', (arg: any) => new AddSubmoduleModalViewModel(arg.repoPath));

/**
 * Form receives collection of user inputs, i.e. username, password and etc.
 */
class FormModalViewModel extends ModalViewModel {
  items: Array<FormItems>
  showCancel: boolean
  template: string
  constructor(title: string, taModalName: string, showCancel: boolean) {
    super(title, taModalName);
    this.items = [];
    this.showCancel = showCancel;
    this.template = 'formModal';
  }

  submit() {
    this.close();
  }
}

class CredentialsModalViewModel extends FormModalViewModel {
  constructor(remote: string) {
    super(`Remote ${remote} requires authentication`, 'credentials-dialog', false);
    this.items.push(new FormItems('Username', ko.observable(), 'text', true))
    this.items.push(new FormItems('Password', ko.observable(), 'password', false))
  }

  submit() {
    super.submit();
    ungit.programEvents.dispatch({
      event: 'request-credentials-response',
      username: this.items[0].value(),
      password: this.items[1].value(),
    });
  }
}

class AddRemoteModalViewModel extends FormModalViewModel {
  repoPath: string
  constructor(path: string) {
    super('Add new remote', 'add-remote', true);
    this.repoPath = path;
    this.items.push(new FormItems('Name', ko.observable(), 'text', true))
    this.items.push(new FormItems('Url', ko.observable(), 'text', false))
  }

  async submit() {
    super.submit();
    const name = this.items[0].value();
    await ungit.server.postPromise(`/remotes/${encodeURIComponent(name)}`, {
      path: this.repoPath,
      url: this.items[1].value(),
    });
    ungit.programEvents.dispatch({ event: 'update-remote' });
  }
}

class AddSubmoduleModalViewModel extends FormModalViewModel {
  repoPath: string
  constructor(path: string) {
    super('Add new submodule', 'add-submodule', true);
    this.repoPath = path;
    this.items.push(new FormItems('Path', ko.observable(), 'text', true))
    this.items.push(new FormItems('Url', ko.observable(), 'text', false))
  }

  async submit() {
    super.submit();
    await ungit.server.postPromise('/submodules/add', {
      path: this.repoPath,
      submodulePath: this.items[0].value(),
      submoduleUrl: this.items[1].value(),
    });
    ungit.programEvents.dispatch({ event: 'submodule-updated' });
    ungit.programEvents.dispatch({ event: 'submodule-fetch' });
  }
}
