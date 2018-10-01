
const ko = require('knockout');
const moment = require('moment');
const components = require('ungit-components');
const storage = require('ungit-storage');

components.register('stash', args => new StashViewModel(args.server, args.repoPath));

class StashItemViewModel {
  constructor(stash, data) {
    this.stash = stash;
    this.server = stash.server;
    this.id = data.reflogId;
    this.sha1 = data.sha1;
    this.title = `${data.reflogName} ${moment(new Date(data.commitDate)).fromNow()}`;
    this.message = data.message;
    this.showCommitDiff = ko.observable(false);

    this.commitDiff = ko.observable(components.create('commitDiff', {
      fileLineDiffs: data.fileLineDiffs.slice(),
      sha1: this.sha1,
      repoPath: stash.repoPath,
      server: stash.server
    }));
  }

  apply() {
    this.server.delPromise(`/stashes/${this.id}`, { path: this.stash.repoPath(), apply: true })
      .catch((e) => this.server.unhandledRejection(e));
  }

  drop() {
    components.create('yesnodialog', { title: 'Are you sure you want to drop the stash?', details: 'This operation cannot be undone.'})
      .show()
      .closeThen((diag) => {
        if (diag.result()) {
          this.server.delPromise(`/stashes/${this.id}`, { path: this.stash.repoPath() })
            .catch((e) => this.server.unhandledRejection(e));
        }
    });
  }

  toggleShowCommitDiffs() {
    this.showCommitDiff(!this.showCommitDiff());
  }
}

class StashViewModel {
  constructor(server, repoPath) {
    this.server = server;
    this.repoPath = repoPath;
    this.stashedChanges = ko.observable([]);
    this.isShow = ko.observable(storage.getItem('showStash') === 'true');
    this.visible = ko.computed(() => this.stashedChanges().length > 0 && this.isShow());
    this.refresh();
  }

  updateNode(parentElement) {
    if (!this.isDisabled) ko.renderTemplate('stash', this, {}, parentElement);
  }

  onProgramEvent(event) {
    if (event.event == 'request-app-content-refresh' ||
      event.event == 'working-tree-changed' ||
      event.event == 'git-directory-changed')
      this.refresh();
  }

  refresh() {
    this.server.getPromise('/stashes', { path: this.repoPath() })
      .then(stashes => {
        let changed = this.stashedChanges().length != stashes.length;
        if (!changed) {
          changed = !this.stashedChanges().every(item1 => stashes.some(item2 => item1.sha1 == item2.sha1));
        }

        if (changed) {
          this.stashedChanges(stashes.map(item => new StashItemViewModel(this, item)));
        }
      }).catch(err => {
        if (err.errorCode != 'no-such-path') this.server.unhandledRejection(err);
      })
  }

  toggleShowStash() {
    this.isShow(!this.isShow());
    storage.setItem('showStash', this.isShow());
  }
}
