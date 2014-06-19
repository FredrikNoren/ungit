
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
  this.server.get('/loggedin', undefined, function(err, status) {
    if (status.loggedIn) {
      self.loggedIn.dispatch();
      self.status('loggedIn');
    }
    else self.status('login');
  });
}
LoginViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('login', this, {}, parentElement);
}
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

