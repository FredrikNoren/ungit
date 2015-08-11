var ko = require('knockout');
var components = require('ungit-components');

components.register('graph', function(args) {
  return new GraphViewModel(args.server, args.repoPath);
});

var GraphViewModel = function(server, repoPath) {
  this.repoPath = ko.observable(repoPath);
  this.server = server;
});
