
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
  this.isUpdating = false;
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
    }).catch((e) => this.server.unhandledRejection(e));
}

SubmodulesViewModel.prototype.updateSubmodules = function() {
  if (this.isUpdating) return;
  this.isUpdating = true;
  return this.server.postPromise('/submodules/update', { path: this.repoPath() })
    .catch((e) => this.server.unhandledRejection(e))
    .finally(() => { this.isUpdating = false; });
}

SubmodulesViewModel.prototype.showAddSubmoduleDialog = function() {
  components.create('addsubmoduledialog')
    .show()
    .closeThen((diag) => {
      if (!diag.isSubmitted()) return;
      this.isUpdating = true;
      this.server.postPromise('/submodules/add', { path: this.repoPath(), submoduleUrl: diag.url(), submodulePath: diag.path() })
        .then(() => { programEvents.dispatch({ event: 'submodule-fetch' }); })
        .catch((e) => this.server.unhandledRejection(e))
        .finally(() => { this.isUpdating = false; });
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
      self.server.delPromise('/submodules', { path: self.repoPath(), submodulePath: submodule.path, submoduleName: submodule.name })
        .then(() => { programEvents.dispatch({ event: 'submodule-fetch' }); })
        .catch((e) => this.server.unhandledRejection(e));
    });
}
