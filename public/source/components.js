

var components = {};
module.exports = components;

components.registered = {};

components.register = function(name, creator) {
  components.registered[name] = creator;
}

components.create = function(name, args) {
  var componentConstructor = components.registered[name];
  if (!componentConstructor) throw new Error('No component found: ' + name);
  return componentConstructor(args);
}