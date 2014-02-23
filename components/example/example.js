

var components = require('ungit-components');

components.register('example', function(args) {
  return {
    createNode: function() {
      var node = document.createElement('div');
      node.innerHTML = "Example";
      return node;
    }
  };
});