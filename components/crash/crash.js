const ko = require('knockout');
const components = require('ungit-components');

components.register('crash', (err) => new CrashViewModel(err));

class CrashViewModel {
  constructor(err) {
    this.eventcause = err ? err : 'unknown error'
  }

  updateNode(parentElement) {
    ko.renderTemplate('crash', this, {}, parentElement);
  }
}
