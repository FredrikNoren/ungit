
var ko = require('knockout');
var components = require('ungit-components');
var async = require('async');
var _ = require('lodash');

components.register('repository', function(args) {
  return new RepositoryViewModel(args.server, args.path);
});

var RepositoryViewModel = function(server, path) {
  var self = this;

  this.server = server;
  this.isBareDir = path.status() === 'bare';
  this.repoPath = path.repoPath;
  this.gitErrors = components.create('gitErrors', { server: server, repoPath: this.repoPath });
  this.graph = components.create('graph', { server: server, repoPath: this.repoPath });
  this.remotes = components.create('remotes', { server: server, repoPath: this.repoPath });
  this.submodules = components.create('submodules', { server: server, repoPath: this.repoPath });
  this.stash = this.isBareDir ? {} : components.create('stash', { server: server, repoPath: this.repoPath });
  this.staging = this.isBareDir ? {} : components.create('staging', { server: server, repoPath: this.repoPath });
  this.branches = components.create('branches', { server: server, repoPath: this.repoPath });
  this.repoPath.subscribe(function(value) { self.sever.watchRepository(value); });
  this.server.watchRepository(this.repoPath());
  this.showLog = self.isBareDir ? ko.observable(true) : self.staging.isStageValid;
  this.parentModulePath = ko.observable();
  this.parentModuleLink = ko.observable();
  this.isSubmodule = ko.computed(function() {
    return self.parentModulePath() && self.parentModuleLink();
  });
  this.refreshSubmoduleStatus();
  if (window.location.search.indexOf('noheader=true') >= 0) {
    this.refreshButton = components.create('refreshbutton');
  } else {
    this.refreshButton = false;
  }
}
RepositoryViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('repository', this, {}, parentElement);
}
RepositoryViewModel.prototype.onProgramEvent = function(event) {
  if (this.gitErrors.onProgramEvent) this.gitErrors.onProgramEvent(event);
  if (this.graph.onProgramEvent) this.graph.onProgramEvent(event);
  if (this.staging.onProgramEvent) this.staging.onProgramEvent(event);
  if (this.stash.onProgramEvent) this.stash.onProgramEvent(event);
  if (this.remotes.onProgramEvent) this.remotes.onProgramEvent(event);
  if (this.submodules.onProgramEvent) this.submodules.onProgramEvent(event);
  if (this.branches.onProgramEvent) this.branches.onProgramEvent(event);
  if (event.event == 'connected') this.server.watchRepository(this.repoPath());

  // If we get a reconnect event it's usually because the server crashed and then restarted
  // or something like that, so we need to tell it to start watching the path again
}
RepositoryViewModel.prototype.updateAnimationFrame = function(deltaT) {
  if (this.graph.updateAnimationFrame) this.graph.updateAnimationFrame(deltaT);
}
RepositoryViewModel.prototype.refreshSubmoduleStatus = function() {
  var self = this;

  return this.server.getPromise('/baserepopath', { path: this.repoPath() })
    .then(function(baseRepoPath) {
      if (baseRepoPath.path) {
        return self.server.getProimse('/submodules', { path: baseRepoPath.path })
          .then(function(submodules) {
            if (Array.isArray(submodules)) {
              var baseName = self.repoPath().substring(baseRepoPath.path.length + 1);
              for (var n = 0; n < submodules.length; n++) {
                if (submodules[n].path === baseName) {
                  self.parentModulePath(baseRepoPath.path);
                  self.parentModuleLink('/#/repository?path=' + encodeURIComponent(baseRepoPath.path));
                  return;
                }
              }
            }
          });
      }
    }).catch(function(err) {
      self.parentModuleLink(undefined);
      self.parentModulePath(undefined);
    });
}
