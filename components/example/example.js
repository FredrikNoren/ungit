

var components = require('ungit-components');

components.register('example', function(args) {
  return {
    updateNode: function(parentNode) {
      parentNode.innerHTML = "Example";
    }
  };
});