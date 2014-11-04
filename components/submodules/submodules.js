
var ko = require('knockout');
var _ = require('lodash');
var async = require('async');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');

components.register('submodules', function(args) {
  return new SubmodulesViewModel(args.server, args.repoPath);
});

function SubmodulesViewModel(server, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.server = server;
  
  this.submodules = ko.observableArray();
}

SubmodulesViewModel.prototype.updateNode = function(parentElement) {
  var self = this;
  
  this.server.get('/submodules', { path: this.repoPath }, function(err, submodules) {
    // if returned is not array, don't render submodules module
    if (!submodules || Object.prototype.toString.call(submodules) !== '[object Array]') {
      return;
    }
    
    self.submodules(submodules);
    
    if (self.submodules().length > 0) {
      ko.renderTemplate('submodules', self, {}, parentElement);
    }
  });
}
