const ko = require('knockout');
const _ = require('lodash');
const octicons = require('octicons');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');

components.register('remotes', (args) => new RemotesViewModel(args.server, args.repoPath));

class RemotesViewModel {
  constructor(server, repoPath) {
    this.repoPath = repoPath;
    this.server = server;
    this.remotes = ko.observable([]);
    this.currentRemote = ko.observable(null);
    this.currentRemote.subscribe((value) => {
      programEvents.dispatch({ event: 'current-remote-changed', newRemote: value });
    });
    this.fetchLabel = ko.computed(() => {
      if (this.currentRemote()) return `Fetch from ${this.currentRemote()}`;
      else return 'No remotes specified';
    });
    this.remotesIcon = octicons.download.toSVG({ height: 18 });
    this.closeIcon = octicons.x.toSVG({ height: 18 });

    this.fetchEnabled = ko.computed(() => this.remotes().length > 0);

    this.shouldAutoFetch = ungit.config.autoFetch;
    this.updateRemotes();
  }

  updateNode(parentElement) {
    ko.renderTemplate('remotes', this, {}, parentElement);
  }

  clickFetch() {
    this.fetch({ nodes: true, tags: true });
  }

  async onProgramEvent(event) {
    if (event.event === 'request-app-content-refresh' || event.event === 'request-fetch-tags') {
      await this.fetch({ tags: true });
    } else if (event.event === 'git-directory-changed' && this.shouldAutoFetch) {
      await this.fetch({ tags: true });
    } else if (event.event === 'update-remote') {
      await this.updateRemotes();
    }
  }

  async fetch(options) {
    if (!this.currentRemote()) return;
    ungit.logger.debug('remotes.fetch() triggered');

    try {
      const tagPromise = options.tags
        ? this.server.getPromise('/remote/tags', {
            path: this.repoPath(),
            remote: this.currentRemote(),
          })
        : null;
      const fetchPromise = options.nodes
        ? this.server.getPromise('/fetch', { path: this.repoPath(), remote: this.currentRemote() })
        : null;

      if (tagPromise) {
        programEvents.dispatch({ event: 'remote-tags-update', tags: await tagPromise });
      }
      if (fetchPromise) {
        await fetchPromise;
      }
      if (!this.server.isInternetConnected) {
        this.server.isInternetConnected = true;
      }
    } catch (err) {
      let errorMessage;
      let stdout;
      let stderr;
      try {
        errorMessage = `Ungit has failed to fetch a remote.  ${err.res.body.error}`;
        stdout = err.res.body.stdout;
        stderr = err.res.body.stderr;
      } catch {
        errorMessage = '';
      }

      if (errorMessage.includes('Could not resolve host')) {
        if (this.server.isInternetConnected) {
          this.server.isInternetConnected = false;
          errorMessage =
            'Could not resolve host. This usually means you are disconnected from internet and no longer push or fetch from remote. However, Ungit will be functional for local git operations.';
          stdout = '';
          stderr = '';
        } else {
          // Message is already seen, just return
          return;
        }
      }

      programEvents.dispatch({
        event: 'git-error',
        data: {
          isWarning: true,
          command: err.res.body.command,
          error: err.res.body.error,
          stdout,
          stderr,
          repoPath: err.res.body.workingDirectory,
        },
      });
    } finally {
      ungit.logger.debug('remotes.fetch() finished');
    }
  }

  updateRemotes() {
    return this.server
      .getPromise('/remotes', { path: this.repoPath() })
      .then((remotes) => {
        remotes = remotes.map((remote) => ({
          name: remote.name,
          title:
            remote.fetchUrl == remote.pushUrl
              ? `Fetch/Push ${remote.fetchUrl || remote.pushUrl || remote.url}`
              : `Fetch ${remote.fetchUrl || remote.url}\nPush ${remote.pushUrl || remote.url}`,
          changeRemote: () => {
            this.currentRemote(remote.name);
          },
        }));
        this.remotes(remotes);
        if (!this.currentRemote() && remotes.length > 0) {
          if (_.find(remotes, { name: 'origin' })) {
            // default to origin if it exists
            this.currentRemote('origin');
          } else {
            // otherwise take the first one
            this.currentRemote(remotes[0].name);
          }

          if (this.shouldAutoFetch) {
            this.shouldAutoFetch = false;
            return this.fetch({ nodes: true, tags: true });
          }
        }
      })
      .catch((err) => {
        if (err.errorCode != 'not-a-repository') {
          this.server.unhandledRejection(err);
        } else {
          ungit.logger.warn('updateRemotes failed', err);
        }
      });
  }

  showAddRemoteDialog() {
    components.showModal('addremotemodal', { path: this.repoPath() });
  }

  remoteRemove(remote) {
    components.showModal('yesnomodal', {
      title: 'Are you sure?',
      details: `Deleting ${remote.name} remote cannot be undone with ungit.`,
      closeFunc: (isYes) => {
        if (isYes) {
          this.server
            .delPromise(`/remotes/${remote.name}`, { path: this.repoPath() })
            .then(() => {
              this.updateRemotes();
            })
            .catch((e) => this.server.unhandledRejection(e));
        }
      },
    });
  }
}
