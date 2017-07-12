
var ko = require('knockout');
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

  this.updateProgressBar = components.create('progressBar', { predictionMemoryKey: 'Updating Submodules', temporary: true });
  this.fetchProgressBar = components.create('progressBar', { predictionMemoryKey: 'Adding Submodule', temporary: true });
}

SubmodulesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'submodule-fetch') this.fetchSubmodules();
}

SubmodulesViewModel.prototype.updateNode = function(parentElement) {
  this.fetchSubmodules().then(function(submoduleViewModel) {
    ko.renderTemplate('submodules', submoduleViewModel, {}, parentElement);
  });
}

SubmodulesViewModel.prototype.fetchSubmodules = function() {
  var self = this;
  return this.server.getPromise('/submodules', { path: this.repoPath() })
    .then(function(submodules) {
      self.submodules(submodules && Array.isArray(submodules) ? submodules : []);
      return self;
    });
}

SubmodulesViewModel.prototype.isRunning = function() {
  return (this.updateProgressBar.running() || this.fetchProgressBar.running());
}

SubmodulesViewModel.prototype.updateSubmodules = function() {
  if (this.isRunning()) return;
  var self = this;

  this.updateProgressBar.start();
  return this.server.postPromise('/submodules/update', { path: this.repoPath() }).finally(function() {
    self.updateProgressBar.stop();
  });
}

SubmodulesViewModel.prototype.showAddSubmoduleDialog = function() {
  var self = this;
  components.create('addsubmoduledialog')
    .show()
    .closeThen(function(diag) {
      if (!diag.isSubmitted()) return;
      self.fetchProgressBar.start();
      self.server.postPromise('/submodules/add', { path: self.repoPath(), submoduleUrl: diag.url(), submodulePath: diag.path() }).then(function() {
          programEvents.dispatch({ event: 'submodule-fetch' });
        }).finally(function() { self.fetchProgressBar.stop(); });
    });
}

SubmodulesViewModel.prototype.submoduleLinkClick = function(submodule) {
  window.location.href = submodule.url;
}

SubmodulesViewModel.prototype.submodulePathClick = function(submodule) {
  window.location.href = document.URL + ungit.config.fileSeparator + submodule.path;
}

SubmodulesViewModel.prototype.submoduleRemove = function(submodule) {
  var self = this;
  components.create('yesnodialog', { title: 'Are you sure?', details: 'Deleting ' + submodule.name + ' submodule cannot be undone with ungit.'})
    .show()
    .closeThen(function(diag) {
      if (!diag.result()) return;
      self.fetchProgressBar.start();
      self.server.delPromise('/submodules', { path: self.repoPath(), submodulePath: submodule.path, submoduleName: submodule.name }).catch(function(err, result) {
        console.log(err);
      }).then(function() {
        programEvents.dispatch({ event: 'submodule-fetch' });
        self.fetchProgressBar.stop();
      })
    });
}
