
var ko = require('knockout');
var _ = require('lodash');
var async = require('async');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');

components.register('submodules', function(args) {
  return new SubmdoulesViewModel(args.server, args.repoPath);
});

function SubmdoulesViewModel(server, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.server = server;
  this.submodules = ko.observableArray();
  
  this.submodules.push({ name: 'test1' });
  this.submodules.push({ name: 'test2' });
}
SubmdoulesViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('submodules', this, {}, parentElement);
}
