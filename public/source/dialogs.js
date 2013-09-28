
var ko = require('../vendor/js/knockout-2.2.1');
var signals = require('signals');

function CredentialsDialogViewModel() {
	this.username = ko.observable();
	this.password = ko.observable();
	this.closed = new signals.Signal();
}
exports.CredentialsDialogViewModel = CredentialsDialogViewModel;
CredentialsDialogViewModel.prototype.template = 'credentialsDialog';
CredentialsDialogViewModel.prototype.setCloser = function(closer) {
	this.close = closer;
}
CredentialsDialogViewModel.prototype.onclose = function() {
	this.closed.dispatch();
}


var LoginViewModel = function() {
	var self = this;
	this.loggedIn = new signals.Signal();
	this.status = ko.observable('loading');
	this.username = ko.observable();
	this.password = ko.observable();
	this.loginError = ko.observable();
	api.query('GET', '/loggedin', undefined, function(err, status) {
		if (status.loggedIn) {
			self.loggedIn.dispatch();
			self.status('loggedIn');
		}
		else self.status('login');
	});
}
exports.LoginViewModel = LoginViewModel;
LoginViewModel.prototype.login = function() {
	var self = this;
	api.query('POST', '/login',  { username: this.username(), password: this.password() }, function(err, res) {
		if (err) {
			if (err.res.body.error) {
				self.loginError(err.res.body.error);
				return true;
			}
		} else {
			self.loggedIn.dispatch();
			self.status('loggedIn');
		}
	});
}
LoginViewModel.prototype.template = 'login';