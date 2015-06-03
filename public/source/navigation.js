
var programEvents = require('ungit-program-events');

var navigation = {};
module.exports = navigation;

var hasher = navigation.hasher = require('hasher');
var crossroads = navigation.crossroads = require('crossroads');

navigation.browseTo = function(path) {
  hasher.setHash(path);
}

navigation.init = function() {

  //setup hasher
  function parseHash(newHash, oldHash){
    crossroads.parse(newHash);
    programEvents.dispatch({ event: 'navigation-changed', path: newHash, oldPath: oldHash });
  }
  hasher.initialized.add(parseHash); //parse initial hash
  hasher.changed.add(parseHash); //parse hash changes
  hasher.raw = true;

  hasher.init();

}