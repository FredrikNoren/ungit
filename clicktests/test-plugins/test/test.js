
var components = require('ungit-components');

components.register('app', function(args) {
  return {
    updateNode: function() {
      var node = document.createElement('div');
      node.innerHTML = "App";
      node.dataset.taElement = "dummy-app";
      return node;
    },
    content: function() {}
  };
});
