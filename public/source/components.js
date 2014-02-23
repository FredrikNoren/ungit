

var components = {};
module.exports = components;

components.registered = {};

components.register = function(name, creator) {
  components.registered[name] = creator;
}

components.create = function(name, args) {
  return components.registered[name](args);
}