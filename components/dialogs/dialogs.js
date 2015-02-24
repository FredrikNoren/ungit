
var ko = require('knockout');
var signals = require('signals');
var inherits = require('util').inherits;
var components = require('ungit-components');

components.register('formdialog', function(args) {
  return new FormDialogViewModel(args.title);
});

components.register('credentialsdialog', function(args) {
  return new CredentialsDialogViewModel();
});

components.register('addremotedialog', function(args) {
  return new AddRemoteDialogViewModel();
});

components.register('addsubmoduledialog', function(args) {
  return new AddSubmoduleDialogViewModel();
});

components.register('promptdialog', function(args) {
  return new PromptDialogViewModel(args.title, args.details);
});

components.register('yesnodialog', function(args) {
  return new YesNoDialogViewModel(args.title, args.details);
});

components.register('TooManyFilesDialogViewModel', function(args) {
  return new TooManyFilesDialogViewModel(args.title, args.details);
});

function DialogViewModel(title) {
  this.closed = new signals.Signal();
  this.title = ko.observable(title);
  this.taDialogName = ko.observable('');
}
DialogViewModel.prototype.setCloser = function(closer) {
  this.close = closer;
}
DialogViewModel.prototype.onclose = function() {
  this.closed.dispatch();
}

function FormDialogViewModel(title) {
  DialogViewModel.call(this, title);
  this.items = ko.observable([]);
  this.isSubmitted = ko.observable(false);
  this.showCancel = ko.observable(true);
}
inherits(FormDialogViewModel, DialogViewModel);
FormDialogViewModel.prototype.template = 'formDialog';
FormDialogViewModel.prototype.submit = function() {
  this.isSubmitted(true);
  this.close();
}


function CredentialsDialogViewModel() {
  FormDialogViewModel.call(this);
  this.title('Remote requires authentication');
  this.taDialogName('credentials-dialog');
  this.showCancel(false);
  this.username = ko.observable();
  this.password = ko.observable();
  this.items([
    { name: 'Username', value: this.username, placeholder: 'Username', type: 'text', autofocus: true, taName: 'username' },
    { name: 'Password', value: this.password, placeholder: 'Password', type: 'password', autofocus: false, taName: 'password' }
  ]);
}
inherits(CredentialsDialogViewModel, FormDialogViewModel);


function AddRemoteDialogViewModel() {
  FormDialogViewModel.call(this);
  this.title('Add new remote');
  this.taDialogName('add-remote');
  this.name = ko.observable();
  this.url = ko.observable();
  this.items([
    { name: 'Name', value: this.name, placeholder: 'Name', type: 'text', autofocus: true, taName: 'name' },
    { name: 'Url', value: this.url, placeholder: 'Url', type: 'text', autofocus: false, taName: 'url' }
  ]);
}
inherits(AddRemoteDialogViewModel, FormDialogViewModel);

function AddSubmoduleDialogViewModel() {
  FormDialogViewModel.call(this);
  this.title('Add new submodule');
  this.taDialogName('add-submodule');
  this.path = ko.observable();
  this.url = ko.observable();
  this.items([
    { name: 'Path', value: this.path, placeholder: 'Path', type: 'text', autofocus: true, taName: 'path' },
    { name: 'Url', value: this.url, placeholder: 'Url', type: 'text', autofocus: false, taName: 'url' }
  ]);
}
inherits(AddSubmoduleDialogViewModel, FormDialogViewModel);

function PromptDialogViewModel(title, details) {
  DialogViewModel.call(this, title);
  this.alternatives = ko.observable();
  this.details = ko.observable(details);
}
inherits(PromptDialogViewModel, DialogViewModel);
PromptDialogViewModel.prototype.template = 'prompt';

function YesNoDialogViewModel(title, details) {
  PromptDialogViewModel.call(this, title, details);
  var self = this;
  this.taDialogName('yes-no-dialog');
  this.result = ko.observable(false);
  this.alternatives([
    { label: 'Yes', primary: true, taId: 'yes', click: function() { self.result(true); self.close(); } },
    { label: 'No', primary: false, taId: 'no', click: function() { self.result(false); self.close(); } },
  ]);
}
inherits(YesNoDialogViewModel, PromptDialogViewModel);

function TooManyFilesDialogViewModel(title, details) {
  PromptDialogViewModel.call(this, title, details);
  var self = this;
  this.taDialogName('yes-no-dialog');
  this.result = ko.observable(false);
  this.alternatives([
    { label: "Don't load", primary: true, taId: 'noLoad', click: function() { self.result(false); self.close(); } },
    { label: 'Load anyway', primary: false, taId: 'loadAnyway', click: function() { self.result(true); self.close(); } },
  ]);
}
inherits(TooManyFilesDialogViewModel, PromptDialogViewModel);
