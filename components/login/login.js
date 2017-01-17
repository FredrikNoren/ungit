
var ko = require('knockout');
var components = require('ungit-components');
var signals = require('signals');

components.register('login', function(args) {
  return new LoginViewModel(args.server);
});

var LoginViewModel = function(server) {
  var self = this;
  this.server = server;
  this.loggedIn = new signals.Signal();
  this.status = ko.observable('loading');
  this.username = ko.observable();
  this.password = ko.observable();
  this.loginError = ko.observable();
  this.server.getPromise('/loggedin')
    .then(function(status) {
      if (status.loggedIn) {
        self.loggedIn.dispatch();
        self.status('loggedIn');
      } else {
        self.status('login');
      }
    }).catch(function(err) { });
}
LoginViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('login', this, {}, parentElement);
}
LoginViewModel.prototype.login = function() {
  var self = this;
  this.server.postPromise('/login', { username: this.username(), password: this.password() }).then(function(res) {
    self.loggedIn.dispatch();
    self.status('loggedIn');
  }).catch(function(err) {
    if (err.res.body.error) {
      self.loginError(err.res.body.error);
    } else {
      throw err;
    }
  });
}
