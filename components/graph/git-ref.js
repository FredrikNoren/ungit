var ko = require('knockout');
var programEvents = require('ungit-program-events');
var components = require('ungit-components');

var RefViewModel = function(fullRefName, graph) {
  this.graph = graph;
  this.fullRefName = fullRefName;
  this.node = ko.observable();
  
};

module.exports = RefViewModel;
