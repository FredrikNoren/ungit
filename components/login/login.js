
const ko = require('knockout');
const components = require('ungit-components');
const signals = require('signals');

components.register('login', args => new LoginViewModel(args.server));

class LoginViewModel {
  constructor(server) {
    this.server = server;
    this.loggedIn = new signals.Signal();
    this.status = ko.observable('loading');
    this.username = ko.observable();
    this.password = ko.observable();
    this.loginError = ko.observable();
    this.server.getPromise('/loggedin')
      .then(status => {
        if (status.loggedIn) {
          this.loggedIn.dispatch();
          this.status('loggedIn');
        } else {
          this.status('login');
        }
      }).catch(err => { });
  }

  updateNode(parentElement) {
    ko.renderTemplate('login', this, {}, parentElement);
  }

  login() {
    this.server.postPromise('/login', { username: this.username(), password: this.password() }).then(res => {
      this.loggedIn.dispatch();
      this.status('loggedIn');
    }).catch(err => {
      if (err.res.body.error) {
        this.loginError(err.res.body.error);
      } else {
        this.server.unhandledRejection(err);
      }
    });
  }
}
