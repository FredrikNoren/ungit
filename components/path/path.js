
var ko = require('knockout');
var components = require('ungit-components');
var addressParser = require('ungit-address-parser');
var navigation = require('ungit-navigation');
var programEvents = require('ungit-program-events');
const NProgress = require('nprogress');
NProgress.configure({
  trickleRate: 0.06,
  trickleSpeed: 200
});

components.register('path', function(args) {
  return new PathViewModel(args.server, args.path);
});

var PathViewModel = function(server, path) {
  var self = this;
  this.server = server;
  this.repoPath = ko.observable(path);
  this.dirName = this.repoPath().replace('\\', '/')
                   .split('/')
                   .filter(function(s) { return s; })
                   .slice(-1)[0] || '/';

  this.status = ko.observable('loading');
  this.cloneUrl = ko.observable();
  NProgress.start();
  this.showDirectoryCreatedAlert = ko.observable(false);
  this.cloneDestinationImplicit = ko.computed(function() {
    var defaultText = 'destination folder';
    if (!self.cloneUrl()) return defaultText;

    var parsedAddress = addressParser.parseAddress(self.cloneUrl());
    return parsedAddress.shortProject || defaultText;
  });
  this.cloneDestination = ko.observable();
  this.repository = ko.observable();
}
PathViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('path', this, {}, parentElement);
}
PathViewModel.prototype.template = 'path';
PathViewModel.prototype.shown = function() {
  this.updateStatus();
}
PathViewModel.prototype.updateAnimationFrame = function(deltaT) {
  if (this.repository())
    this.repository().updateAnimationFrame(deltaT);
}
PathViewModel.prototype.updateStatus = function() {
  var self = this;
  return this.server.getPromise('/quickstatus', { path: this.repoPath() })
    .then(function(status){
      if (status.type == 'inited' || status.type == 'bare') {
        if (self.repoPath() !== status.gitRootPath) {
          self.repoPath(status.gitRootPath);
          programEvents.dispatch({ event: 'navigated-to-path', path: self.repoPath() });
          programEvents.dispatch({ event: 'working-tree-changed' });
        }
        self.status(status.type);
        if (!self.repository()) {
          self.repository(components.create('repository', { server: self.server, path: self }));
        }
      } else if (status.type == 'uninited' || status.type == 'no-such-path') {
        self.status(status.type);
        self.repository(null);
      }
      return null;
    }).catch((err) => { })
    .finally(() => { NProgress.done(); });
}
PathViewModel.prototype.initRepository = function() {
  var self = this;
  return this.server.postPromise('/init', { path: this.repoPath() })
    .finally(function(res) { self.updateStatus(); });
}
PathViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'working-tree-changed') this.updateStatus();
  else if (event.event == 'request-app-content-refresh') this.updateStatus();

  if (this.repository()) this.repository().onProgramEvent(event);
}
PathViewModel.prototype.cloneRepository = function() {
  var self = this;
  self.status('cloning');
  NProgress.start();
  var dest = this.cloneDestination() || this.cloneDestinationImplicit();

  return this.server.postPromise('/clone', { path: this.repoPath(), url: this.cloneUrl(), destinationDir: dest })
    .then((res) => navigation.browseTo('repository?path=' + encodeURIComponent(res.path)) )
    .finally(() => {
      NProgress.done();
      programEvents.dispatch({ event: 'working-tree-changed' });
    })
}
PathViewModel.prototype.createDir = function() {
  var self = this;
  this.showDirectoryCreatedAlert(true);
  return this.server.postPromise('/createDir',  { dir: this.repoPath() })
    .then(function() { self.updateStatus(); });
}
