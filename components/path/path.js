
var ko = require('knockout');
var components = require('ungit-components');

components.register('path', function(args) {
  return new PathViewModel(args.app, args.path);
});

var PathViewModel = function(app, path) {
  var self = this;
  this.app = app;
  this.path = path;
  this.status = ko.observable('loading');
  this.loadingProgressBar = components.create('progressBar', { predictionMemoryKey: 'path-loading-' + path });
  this.loadingProgressBar.start();
  this.cloningProgressBar = components.create('progressBar', {
    predictionMemoryKey: 'path-cloning-' + path,
    fallbackPredictedTimeMs: 10000
  });
  this.cloneUrl = ko.observable();
  this.unitiedPathTitle = ko.observable();
  this.cloneDestinationImplicit = ko.computed(function() {
    var defaultText = 'destination folder';
    if (!self.cloneUrl()) return defaultText;

    var parsedAddress = addressParser.parseAddress(self.cloneUrl());
    return parsedAddress.shortProject || defaultText;
  });
  this.cloneDestination = ko.observable();
  this.repository = ko.observable();
}
exports.PathViewModel = PathViewModel;
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
  self.unitiedPathTitle('Not a repository');
  this.app.get('/quickstatus', { path: this.path }, function(err, status){
    self.loadingProgressBar.stop();
    if (err) return;
    if (status == 'inited') {
      self.status('repository');
      self.repository(components.create('repository', { app: self.app, repoPath: self.path }));
    } else if (status == 'uninited') {
      self.status('uninited');
    } else if (status == 'no-such-path') {
      self.status('invalidpath');
    }
  });
}
PathViewModel.prototype.onWorkingTreeChanged = function() {
  if (this.repository()) this.repository().onWorkingTreeChanged();
}
PathViewModel.prototype.onGitDirectoryChanged = function() {
  if (this.repository()) this.repository().onGitDirectoryChanged();
}
PathViewModel.prototype.initRepository = function() {
  var self = this;
  this.app.post('/init', { path: this.path }, function(err, res) {
    if (err) return;
    self.updateStatus();
  });
}
PathViewModel.prototype.cloneRepository = function() {
  var self = this;
  self.status('cloning');
  this.cloningProgressBar.start();
  var dest = this.cloneDestination() || this.cloneDestinationImplicit();

  var programEventListener = function(event) {
    if (event.event == 'credentialsRequested') self.cloningProgressBar.pause();
    else if (event.event == 'credentialsProvided') self.cloningProgressBar.unpause();
  };
  this.app.programEvents.add(programEventListener);

  this.app.post('/clone', { path: this.path, url: this.cloneUrl(), destinationDir: dest }, function(err, res) {
    self.app.programEvents.remove(programEventListener);
    self.cloningProgressBar.stop();
    if (err) return;
    self.app.browseTo('repository?path=' + encodeURIComponent(res.path));
  });
}
PathViewModel.prototype.createDir = function() {
  var self = this;
  self.unitiedPathTitle('Directory created');
  this.app.post('/createDir',  {dir: this.path }, function() {
    self.status('uninited');
  });
}
PathViewModel.prototype.refreshContent = function(callback) {
  if (this.repository()) this.repository().refreshContent(callback);
  else callback();
}

 
