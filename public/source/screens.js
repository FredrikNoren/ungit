
var ko = require('knockout');
var components = require('./components');
var addressParser = require('../../source/address-parser');
var signals = require('signals');


var CrashViewModel = function() {
}
exports.CrashViewModel = CrashViewModel;
CrashViewModel.prototype.template = 'crash';


var UserErrorViewModel = function(args) {
  if (typeof(arguments[0]) == 'string')
    args = { title: arguments[0], details: arguments[1] };
  args = args || {};
  this.title = ko.observable(args.title);
  this.details = ko.observable(args.details);
}
exports.UserErrorViewModel = UserErrorViewModel;
UserErrorViewModel.prototype.template = 'usererror';


var LoginViewModel = function(server) {
  var self = this;
  this.server = server;
  this.loggedIn = new signals.Signal();
  this.status = ko.observable('loading');
  this.username = ko.observable();
  this.password = ko.observable();
  this.loginError = ko.observable();
  this.server.get('/loggedin', undefined, function(err, status) {
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
  this.server.post('/login', { username: this.username(), password: this.password() }, function(err, res) {
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
