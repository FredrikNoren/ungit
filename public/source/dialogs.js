
var ko = require('../vendor/js/knockout-2.2.1');
var signals = require('signals');
var inherits = require('util').inherits;

function FormDialogViewModel() {
	this.closed = new signals.Signal();
	this.items = ko.observable([]);
	this.title = ko.observable();
	this.isSubmitted = ko.observable(false);
	this.showCancel = ko.observable(true);
	this.taDialogName = ko.observable('');
}
FormDialogViewModel.prototype.template = 'formDialog';
FormDialogViewModel.prototype.setCloser = function(closer) {
	this.close = closer;
}
FormDialogViewModel.prototype.onclose = function() {
	this.closed.dispatch();
}
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
exports.CredentialsDialogViewModel = CredentialsDialogViewModel;


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
exports.AddRemoteDialogViewModel = AddRemoteDialogViewModel;
