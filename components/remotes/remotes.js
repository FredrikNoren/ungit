
var ko = require('knockout');
var _ = require('lodash');
var async = require('async');
var components = require('ungit-components');
var ProgressBarViewModel = require('ungit-controls').ProgressBarViewModel;
var dialogs = require('ungit-dialogs');

components.register('remotes', function(args) {
  return new RemotesViewModel(args.repositoryViewModel);
});

function RemotesViewModel(repository) {
  var self = this;
  this.repository = repository;
  this.repoPath = repository.repoPath;
  this.app = repository.app;
  this.remotes = ko.observable([]);
  this.currentRemote = ko.observable(null);
  this.fetchLabel = ko.computed(function() {
    if (self.currentRemote()) return 'Fetch nodes from ' + self.currentRemote();
    else return 'No remotes specified';
  })

  this.fetchingProgressBar = new ProgressBarViewModel('fetching-' + this.repoPath);

  this.fetchEnabled = ko.computed(function() {
    return self.remotes().length > 0;
  });

  this.shouldAutoFetch = ungit.config.autoFetch;
}
RemotesViewModel.prototype.updateNode = function(parentElement) {
  return ko.renderTemplate('remotes', this, {}, parentElement);
}
RemotesViewModel.prototype.clickFetch = function() { this.fetch({ nodes: true, tags: true }); }
RemotesViewModel.prototype.fetch = function(options, callback) {
  if (this.fetchingProgressBar.running()) return;
  var self = this;

  var programEventListener = function(event) {
    if (event.event == 'credentialsRequested') self.fetchingProgressBar.pause();
    else if (event.event == 'credentialsProvided') self.fetchingProgressBar.unpause();
  };
  this.app.programEvents.add(programEventListener);

  this.fetchingProgressBar.start();
  var jobs = [];
  if (options.tags) jobs.push(function(done) { self.app.get('/remote/tags', { path: self.repoPath, remote: self.currentRemote() }, done); });
  if (options.nodes) jobs.push(function(done) { self.app.post('/fetch', { path: self.repoPath, remote: self.currentRemote() }, done);  });
  async.parallel(jobs, function(err, result) {
    self.app.programEvents.remove(programEventListener);
    self.fetchingProgressBar.stop();

    if (!err && options.tags) self.repository.graph.setRemoteTags(result[0]);
  });
}

RemotesViewModel.prototype.updateRemotes = function() {
  var self = this;
  this.app.get('/remotes', { path: this.repoPath }, function(err, remotes) {
    if (err && err.errorCode == 'not-a-repository') return true;
    if (err) return;
    remotes = remotes.map(function(remote) {
      return {
        name: remote,
        changeRemote: function() { self.currentRemote(remote) }
      }
    });
    self.remotes(remotes);
    self.repository.graph.hasRemotes(remotes.length != 0);
    if (!self.currentRemote() && remotes.length > 0) {
      if (_.find(remotes, { 'name': 'origin' })) // default to origin if it exists
        self.currentRemote('origin');
      else // otherwise take the first one
        self.currentRemote(remotes[0].name);
      if (self.shouldAutoFetch) {
        self.fetch({ nodes: true, tags: true });
      }
    }
    self.shouldAutoFetch = false;
  });
}
RemotesViewModel.prototype.showAddRemoteDialog = function() {
  var self = this;
  var diag = new dialogs.AddRemoteDialogViewModel();
  diag.closed.add(function() {
    if (diag.isSubmitted()) {
      self.app.post('/remotes/' + encodeURIComponent(diag.name()), { path: self.repoPath, url: diag.url() }, function(err, res) {
        if (err) return;
        self.updateRemotes();
      })
    }
  });
  this.app.showDialog(diag);
}

