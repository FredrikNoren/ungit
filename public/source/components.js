const components = {};
module.exports = components;
ungit.components = components;

components.registered = {};

components.register = function (name, creator) {
  components.registered[name] = creator;
};

components.create = function (name, args) {
  var componentConstructor = components.registered[name];
  if (!componentConstructor) throw new Error('No component found: ' + name);
  return componentConstructor(args);
};

components.showModal = (name, args) => {
  const modal = components.create(name, args);
  ungit.programEvents.dispatch({ event: 'modal-show-dialog', modal: modal });
  return modal;
};
