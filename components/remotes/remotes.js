
const ko = require('knockout');
const _ = require('lodash');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const promise = require('bluebird');

components.register('remotes', args => new RemotesViewModel(args.server, args.repoPath));

class RemotesViewModel {
  constructor(server, repoPath) {
    this.repoPath = repoPath;
    this.server = server;
    this.remotes = ko.observable([]);
    this.currentRemote = ko.observable(null);
    this.currentRemote.subscribe(value => {
      programEvents.dispatch({ event: 'current-remote-changed', newRemote: value });
    });
    this.fetchLabel = ko.computed(() => {
      if (this.currentRemote()) return `Fetch from ${this.currentRemote()}`;
      else return 'No remotes specified';
    })

    this.fetchEnabled = ko.computed(() => this.remotes().length > 0);

    this.shouldAutoFetch = ungit.config.autoFetch;
    this.updateRemotes();
    this.isFetching = false;
    this.fetchDebounced = _.debounce(() => this.fetch({ tags: true }), 500);
  }

  updateNode(parentElement) {
    ko.renderTemplate('remotes', this, {}, parentElement);
  }

  clickFetch() { this.fetch({ nodes: true, tags: true }); }

  onProgramEvent(event) {
    if (event.event === 'working-tree-changed' || event.event === 'request-app-content-refresh' ||
      event.event === 'request-fetch-tags' || event.event === 'git-directory-changed') {
      this.fetchDebounced();
    }
  }

  fetch(options) {
    if (this.isFetching || !this.currentRemote()) return;

    this.isFetching = true;
    const tagPromise = options.tags ? this.server.getPromise('/remote/tags', { path: this.repoPath(), remote: this.currentRemote() }) : null;
    const fetchPromise = options.nodes ? this.server.postPromise('/fetch', { path: this.repoPath(), remote: this.currentRemote() }) : null;
    return promise.props({tag: tagPromise, fetch: fetchPromise})
      .then((result) => {
        if (options.tags) {
          programEvents.dispatch({ event: 'remote-tags-update', tags: result.tag });
        }
        if (!this.server.isInternetConnected) {
          this.server.isInternetConnected = true;
        }
      }).catch((err) => {
      let errorMessage;
      let stdout;
      let stderr;
      try {
        errorMessage = `Ungit has failed to fetch a remote.  ${err.res.body.error}`;
        stdout = err.res.body.stdout;
        stderr = err.res.body.stderr;
      } catch (e) { errorMessage = ''; }

      if (errorMessage.includes('Could not resolve host')) {
        if (this.server.isInternetConnected) {
          this.server.isInternetConnected = false;
          errorMessage = `Could not resolve host.  This usually means you are disconnected from internet and no longer push or fetch from remote. However, Ungit will be functional for local git operations.`;
          stdout = '';
          stderr = '';
        } else {
          // Message is already seen, just return
          return;
        }
      }

      programEvents.dispatch({ event: 'git-error', data: {
        isWarning: true,
        command: err.res.body.command,
        error: err.res.body.error,
        stdout,
        stderr,
        repoPath: err.res.body.workingDirectory
      } });
    }).finally(() => { this.isFetching = false; });
  }

  updateRemotes() {
    return this.server.getPromise('/remotes', { path: this.repoPath() })
      .then(remotes => {
        remotes = remotes.map(remote => ({
          name: remote,
          changeRemote: () => { this.currentRemote(remote) }
        }));
        this.remotes(remotes);
        if (!this.currentRemote() && remotes.length > 0) {
          if (_.find(remotes, { 'name': 'origin' })) {// default to origin if it exists
            this.currentRemote('origin');
          } else {// otherwise take the first one
            this.currentRemote(remotes[0].name);
          }

          if (this.shouldAutoFetch) {
            this.shouldAutoFetch = false;
            return this.fetch({ nodes: true, tags: true });
          }
        }
      }).catch(err => {
        if (err.errorCode != 'not-a-repository') this.server.unhandledRejection(err);
      });
  }

  showAddRemoteDialog() {
    components.create('addremotedialog')
      .show()
      .closeThen((diag) => {
        if(diag.isSubmitted()) {
          return this.server.postPromise(`/remotes/${encodeURIComponent(diag.name())}`, { path: this.repoPath(), url: diag.url() })
            .then(() => { this.updateRemotes(); })
            .catch((e) => this.server.unhandledRejection(e));
        }
      });
  }

  remoteRemove(remote) {
    components.create('yesnodialog', { title: 'Are you sure?', details: `Deleting ${remote.name} remote cannot be undone with ungit.`})
      .show()
      .closeThen((diag) => {
        if (diag.result()) {
          return this.server.delPromise(`/remotes/${remote.name}`, { path: this.repoPath() })
            .then(() => { this.updateRemotes(); })
            .catch((e) => this.server.unhandledRejection(e));
        }
      });
  }
}
