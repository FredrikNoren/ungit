
var ko = require('knockout');
var _ = require('lodash');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');
var Promise = require('bluebird');

components.register('remotes', function(args) {
  return new RemotesViewModel(args.server, args.repoPath);
});

function RemotesViewModel(server, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.server = server;
  this.remotes = ko.observable([]);
  this.currentRemote = ko.observable(null);
  this.currentRemote.subscribe(function(value) {
    programEvents.dispatch({ event: 'current-remote-changed', newRemote: value });
  });
  this.fetchLabel = ko.computed(function() {
    if (self.currentRemote()) return 'Fetch from ' + self.currentRemote();
    else return 'No remotes specified';
  })

  this.fetchEnabled = ko.computed(function() {
    return self.remotes().length > 0;
  });

  this.shouldAutoFetch = ungit.config.autoFetch;
  this.updateRemotes();
  this.isFetching = false;
  this.fetchDebounced = _.debounce(() => this.fetch({ tags: true }), 500);
}
RemotesViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('remotes', this, {}, parentElement);
}
RemotesViewModel.prototype.clickFetch = function() { this.fetch({ nodes: true, tags: true }); }
RemotesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event === 'working-tree-changed' || event.event === 'request-app-content-refresh' ||
    event.event === 'request-fetch-tags' || event.event === 'git-directory-changed') {
    this.fetchDebounced();
  }
}
RemotesViewModel.prototype.fetch = function(options) {
  if (this.isFetching || !this.currentRemote()) return;
  var self = this;

  this.isFetching = true;
  var tagPromise = options.tags ? self.server.getPromise('/remote/tags', { path: self.repoPath(), remote: self.currentRemote() }) : null;
  var fetchPromise = options.nodes ? self.server.postPromise('/fetch', { path: self.repoPath(), remote: self.currentRemote() }) : null;
  return Promise.props({tag: tagPromise, fetch: fetchPromise})
    .then((result) => {
      if (options.tags) {
        programEvents.dispatch({ event: 'remote-tags-update', tags: result.tag });
      }
      if (!this.server.isInternetConnected) {
        this.server.isInternetConnected = true;
      }
    }).catch((err) => {
      let errorMessage;
      try { errorMessage = err.res.body.error; }
      catch (e) { errorMessage = ''; }

      if (errorMessage.indexOf('Could not resolve host') > -1) {
        if (this.server.isInternetConnected) {
          programEvents.dispatch({ event: 'git-error', data: {
            isWarning: true,
            command: err.res.body.command,
            error: err.res.body.error,
            stdout: 'This usually means you are disconnected from internet and no longer push or fetch from remote. However, Ungit will be functional for local git operations.',
            stderr: '',
            repoPath: err.res.body.workingDirectory
          } });
          this.server.isInternetConnected = false;
        }
      } else {
        this.server.unhandledRejection(err);
      }
    }).finally(() => { this.isFetching = false; });
}

RemotesViewModel.prototype.updateRemotes = function() {
  var self = this;

  return this.server.getPromise('/remotes', { path: this.repoPath() })
    .then(function(remotes) {
      remotes = remotes.map(function(remote) {
        return {
          name: remote,
          changeRemote: function() { self.currentRemote(remote) }
        }
      });
      self.remotes(remotes);
      if (!self.currentRemote() && remotes.length > 0) {
        if (_.find(remotes, { 'name': 'origin' })) {// default to origin if it exists
          self.currentRemote('origin');
        } else {// otherwise take the first one
          self.currentRemote(remotes[0].name);
        }

        if (self.shouldAutoFetch) {
          self.shouldAutoFetch = false;
          return self.fetch({ nodes: true, tags: true });
        }
      }
    }).catch(function(err) {
      if (err.errorCode != 'not-a-repository') self.server.unhandledRejection(err);
    });
}
RemotesViewModel.prototype.showAddRemoteDialog = function() {
  var self = this;
  components.create('addremotedialog')
    .show()
    .closeThen(function(diag) {
      if(diag.isSubmitted()) {
        return self.server.postPromise('/remotes/' + encodeURIComponent(diag.name()), { path: self.repoPath(), url: diag.url() })
          .then(function() { self.updateRemotes(); })
          .catch((e) => this.server.unhandledRejection(e));
      }
    });
}

RemotesViewModel.prototype.remoteRemove = function(remote) {
  var self = this;
  components.create('yesnodialog', { title: 'Are you sure?', details: 'Deleting ' + remote.name + ' remote cannot be undone with ungit.'})
    .show()
    .closeThen(function(diag) {
      if (diag.result()) {
        return self.server.delPromise('/remotes/' + remote.name, { path: self.repoPath() })
          .then(() => { self.updateRemotes(); })
          .catch((e) => this.server.unhandledRejection(e));
      }
    });
}
