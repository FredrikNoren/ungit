
var ko = require('knockout');
var components = require('ungit-components');

components.register('submodules', function(args) {
  return new SubmodulesViewModel(args.server, args.repoPath);
});

function SubmodulesViewModel(server, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.server = server;
  this.submodules = ko.observableArray();

  this.updateProgressBar = components.create('progressBar', { predictionMemoryKey: 'Updating Submodules', temporary: true });
  this.addProgressBar = components.create('progressBar', { predictionMemoryKey: 'Adding Submodule', temporary: true });
}

SubmodulesViewModel.prototype.updateNode = function(parentElement) {
  var self = this;

  this.server.get('/submodules', { path: this.repoPath }, function(err, submodules) {
    // if returned is not array, don't render submodules module
    if (submodules && Object.prototype.toString.call(submodules) === '[object Array]') {
      self.submodules(submodules);
    }

    ko.renderTemplate('submodules', self, {}, parentElement);
  });
}

SubmodulesViewModel.prototype.isRunning = function() {
  return (this.updateProgressBar.running() || this.addProgressBar.running());
}

SubmodulesViewModel.prototype.updateSubmodules = function() {
  if (this.isRunning()) return;
  var self = this;

  this.updateProgressBar.start();
  this.server.post('/submodules/update', { path: this.repoPath }, function(err, result) {
    self.updateProgressBar.stop();
  });
}

SubmodulesViewModel.prototype.addSubmodules = function(submoduleUrl, submodulePath) {
  if (this.isRunning()) return;
  var self = this;

  this.addProgressBar.start();
  this.server.post('/submodules/add', { path: this.repoPath, submoduleUrl: submoduleUrl, submodulePath: submodulePath }, function(err, result) {
    self.addProgressBar.stop();
  });
}
