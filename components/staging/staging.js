const ko = require('knockout');
const _ = require('lodash');
const octicons = require('octicons');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const filesToDisplayIncrmentBy = 50;
const filesToDisplayLimit = filesToDisplayIncrmentBy;
const mergeTool = ungit.config.mergeTool;
const { ComponentRoot } = require('../ComponentRoot');

components.register(
  'staging',
  (args) => new StagingViewModel(args.server, args.repoPath, args.graph)
);

class StagingViewModel extends ComponentRoot {
  constructor(server, repoPath, graph) {
    super();
    this.server = server;
    this.repoPath = repoPath;
    this.refreshContent = _.debounce(this._refreshContent, 250, this.defaultDebounceOption);
    this.graph = graph;
    this.filesByPath = {};
    this.files = ko.observableArray();
    this.commitMessageTitleCount = ko.observable(0);
    this.commitMessageTitle = ko.observable();
    this.commitMessageTitle.subscribe((value) => {
      this.commitMessageTitleCount(value.length);
    });
    this.commitMessageBody = ko.observable();
    this.wordWrap = components.create('textdiff.wordwrap');
    this.textDiffType = components.create('textdiff.type');
    this.whiteSpace = components.create('textdiff.whitespace');
    this.inRebase = ko.observable(false);
    this.inMerge = ko.observable(false);
    this.inCherry = ko.observable(false);
    this.conflictText = ko.computed(() => {
      if (this.inMerge()) {
        this.conflictContinue = this.conflictResolution.bind(this, '/merge/continue');
        this.conflictAbort = this.conflictResolution.bind(this, '/merge/abort');
        return 'Merge';
      } else if (this.inRebase()) {
        this.conflictContinue = this.conflictResolution.bind(this, '/rebase/continue');
        this.conflictAbort = this.conflictResolution.bind(this, '/rebase/abort');
        return 'Rebase';
      } else if (this.inCherry()) {
        this.conflictContinue = this.commit;
        this.conflictAbort = this.discardAllChanges;
        return 'Cherry-pick';
      } else {
        this.conflictContinue = undefined;
        this.conflictAbort = undefined;
        return undefined;
      }
    });
    this.HEAD = ko.observable();
    this.isStageValid = ko.computed(() => !this.inRebase() && !this.inMerge() && !this.inCherry());
    this.nFiles = ko.computed(() => this.files().length);
    this.nStagedFiles = ko.computed(
      () => this.files().filter((f) => f.editState() === 'staged').length
    );
    this.allStageFlag = ko.computed(() => this.nFiles() !== this.nStagedFiles());
    this.stats = ko.computed(() => `${this.nFiles()} files, ${this.nStagedFiles()} to be commited`);
    this.amend = ko.observable(false);
    this.canAmend = ko.computed(
      () => this.HEAD() && !this.inRebase() && !this.inMerge() && !this.emptyCommit()
    );
    this.emptyCommit = ko.observable(false);
    this.canEmptyCommit = ko.computed(() => this.HEAD() && !this.inRebase() && !this.inMerge());
    this.canStashAll = ko.computed(() => !this.amend());
    this.canPush = ko.computed(() => !!this.graph.currentRemote());
    this.showNux = ko.computed(
      () => this.files().length == 0 && !this.amend() && !this.inRebase() && !this.emptyCommit()
    );
    this.showCancelButton = ko.computed(() => this.amend() || this.emptyCommit());
    this.commitValidationError = ko.computed(() => {
      if (this.conflictText()) {
        if (this.files().some((file) => file.conflict())) return 'Files in conflict';
      } else {
        if (
          !this.emptyCommit() &&
          !this.amend() &&
          !this.files().some(
            (file) => file.editState() === 'staged' || file.editState() === 'patched'
          )
        ) {
          return 'No files to commit';
        }
        if (!this.commitMessageTitle()) {
          return 'Provide a title';
        }

        if (this.textDiffType.value() === 'sidebysidediff') {
          const patchFiles = this.files().filter((file) => file.editState() === 'patched');
          if (patchFiles.length > 0) return 'Cannot patch with side by side view.';
        }
      }
      return '';
    });
    this.toggleSelectAllGlyphClass = ko.computed(() => {
      if (this.allStageFlag()) return 'glyphicon-unchecked';
      else return 'glyphicon-check';
    });

    this.refreshContentThrottled = _.throttle(this.refreshContent.bind(this), 500, {
      leading: false,
      trailing: true,
    });
    this.invalidateFilesDiffsThrottled = _.throttle(this.invalidateFilesDiffs.bind(this), 500, {
      leading: false,
      trailing: true,
    });
    this.refreshContentThrottled();
    this.loadAnyway = false;
    this.isDiagOpen = false;
    this.mutedTime = null;
    this.discardAllIcon = octicons.trash.toSVG({ height: 15 });
    this.stashIcon = octicons.pin.toSVG({ height: 15 });
    this.discardIcon = octicons.x.toSVG({ height: 18 });
    this.ignoreIcon = octicons.skip.toSVG({ height: 18 });
  }

  updateNode(parentElement) {
    ko.renderTemplate('staging', this, {}, parentElement);
  }

  onProgramEvent(event) {
    if (
      event.event == 'request-app-content-refresh' ||
      event.event === 'working-tree-changed' ||
      event.event === 'git-directory-changed'
    ) {
      this.refreshContent();
      this.invalidateFilesDiffs();
    }
  }

  async _refreshContent() {
    ungit.logger.debug('staging.refreshContent() triggered');

    try {
      const headPromise = this.server.getPromise('/head', { path: this.repoPath(), limit: 1 });
      const statusPromise = this.server.getPromise('/status', {
        path: this.repoPath(),
        fileLimit: filesToDisplayLimit,
      });
      const log = await headPromise;
      if (log.length > 0) {
        const array = log[0].message.split('\n');
        this.HEAD({ title: array[0], body: array.slice(2).join('\n') });
      } else {
        this.HEAD(null);
      }

      const status = await statusPromise;
      if (this.isSamePayload(status)) {
        return;
      }

      if (Object.keys(status.files).length > filesToDisplayLimit && !this.loadAnyway) {
        if (this.isDiagOpen) {
          return;
        }
        this.isDiagOpen = true;
        components.showModal('toomanyfilesmodal', {
          title: 'Too many unstaged files',
          details: 'It is recommended to use command line as ungit may be too slow.',
          closeFunc: (isYes) => {
            this.isDiagOpen = false;
            if (isYes) {
              window.location.href = '/#/';
            } else {
              this.loadAnyway = true;
              this.loadStatus(status);
            }
          },
        });
      } else {
        this.loadStatus(status);
      }
    } catch (err) {
      if (err.errorCode != 'must-be-in-working-tree' && err.errorCode != 'no-such-path') {
        this.server.unhandledRejection(err);
      } else {
        ungit.logger.error('error during staging refresh: ', err);
      }
    } finally {
      ungit.logger.debug('staging.refreshContent() finished');
    }
  }

  loadStatus(status) {
    this.setFiles(status.files);
    this.inRebase(!!status.inRebase);
    this.inMerge(!!status.inMerge);
    // There are time where '.git/CHERRY_PICK_HEAD' file is created and no files are in conflicts.
    // in such cases we should ignore exception as no good way to resolve it.
    this.inCherry(!!status.inCherry && !!status.inConflict);

    if (this.inRebase()) {
      this.commitMessageTitle('Rebase conflict');
      this.commitMessageBody('Commit messages are not applicable!\n(╯°□°）╯︵ ┻━┻');
    } else if (this.inMerge() || this.inCherry()) {
      const lines = status.commitMessage.split('\n');
      if (!this.commitMessageTitle()) {
        this.commitMessageTitle(lines[0]);
        this.commitMessageBody(lines.slice(1).join('\n'));
      }
    }
  }

  setFiles(files) {
    const newFiles = [];
    for (const fileStatus of Object.values(files)) {
      let fileViewModel = this.filesByPath[fileStatus.fileName];
      if (!fileViewModel) {
        this.filesByPath[fileStatus.fileName] = fileViewModel = new FileViewModel(
          this,
          fileStatus.fileName,
          fileStatus.oldFileName,
          fileStatus.displayName
        );
      } else {
        // this is mainly for patching and it may not fire due to the fact that
        // '/commit' triggers working-tree-changed which triggers throttled refresh
        fileViewModel.diff().invalidateDiff();
      }
      fileViewModel.setState(fileStatus);
      newFiles.push(fileViewModel);
    }
    this.files(newFiles);
  }

  toggleAmend() {
    if (!this.amend() && !this.commitMessageTitle()) {
      this.commitMessageTitle(this.HEAD().title);
      this.commitMessageBody(this.HEAD().body);
    } else if (this.amend()) {
      const isPrevDefaultMsg =
        this.commitMessageTitle() == this.HEAD().title &&
        this.commitMessageBody() == this.HEAD().body;
      if (isPrevDefaultMsg) {
        this.commitMessageTitle('');
        this.commitMessageBody('');
      }
    }
    this.amend(!this.amend());
  }

  toggleEmptyCommit() {
    this.commitMessageTitle('Empty commit');
    this.commitMessageBody();
    this.emptyCommit(true);
  }

  resetMessages() {
    this.commitMessageTitle('');
    this.commitMessageBody('');
    for (const key in this.filesByPath) {
      const element = this.filesByPath[key];
      element.diff().invalidateDiff();
      element.patchLineList.removeAll();
      element.isShowingDiffs(false);
      element.editState(element.editState() === 'patched' ? 'none' : element.editState());
    }
    this.amend(false);
    this.emptyCommit(false);
  }

  commit() {
    const files = this.files()
      .filter((file) => file.editState() !== 'none')
      .map((file) => ({
        name: file.name(),
        patchLineList: file.editState() === 'patched' ? file.patchLineList() : null,
      }));
    let commitMessage = this.commitMessageTitle();
    if (this.commitMessageBody()) commitMessage += `\n\n${this.commitMessageBody()}`;

    this.server
      .postPromise('/commit', {
        path: this.repoPath(),
        message: commitMessage,
        files,
        amend: this.amend(),
        emptyCommit: this.emptyCommit(),
      })
      .then(() => {
        this.resetMessages();
        programEvents.dispatch({ event: 'branch-updated' });
      })
      .catch((e) => this.server.unhandledRejection(e));
  }

  commitnpush() {
    const files = this.files()
      .filter((file) => file.editState() !== 'none')
      .map((file) => ({
        name: file.name(),
        patchLineList: file.editState() === 'patched' ? file.patchLineList() : null,
      }));
    let commitMessage = this.commitMessageTitle();
    if (this.commitMessageBody()) commitMessage += `\n\n${this.commitMessageBody()}`;

    this.server
      .postPromise('/commit', {
        path: this.repoPath(),
        message: commitMessage,
        files,
        amend: this.amend(),
        emptyCommit: this.emptyCommit(),
      })
      .then(() => {
        this.resetMessages();
        return this.server.postPromise('/push', {
          path: this.repoPath(),
          remote: this.graph.currentRemote(),
        });
      })
      .catch((err) => {
        if (err.errorCode == 'non-fast-forward') {
          components.showModal('yesnomodal', {
            title: 'Force push?',
            details: "The remote branch can't be fast-forwarded.",
            closeFunc: (isYes) => {
              if (!isYes) return;
              this.server.postPromise('/push', {
                path: this.repoPath(),
                remote: this.graph.currentRemote(),
                force: true,
              });
            },
          });
        } else {
          this.server.unhandledRejection(err);
        }
      });
  }

  conflictResolution(apiPath) {
    let commitMessage = this.commitMessageTitle();
    if (this.commitMessageBody()) commitMessage += `\n\n${this.commitMessageBody()}`;
    this.server
      .postPromise(apiPath, { path: this.repoPath(), message: commitMessage })
      .catch((e) => this.server.unhandledRejection(e))
      .finally(() => {
        this.resetMessages();
      });
  }

  invalidateFilesDiffs() {
    this.files().forEach((file) => {
      file.diff().invalidateDiff();
    });
  }

  cancelAmendEmpty() {
    this.resetMessages();
  }

  discardAllChanges() {
    components.showModal('yesnomodal', {
      title: 'Are you sure you want to discard all changes?',
      details: 'This operation cannot be undone.',
      closeFunc: (isYes) => {
        if (!isYes) return;
        this.server
          .postPromise('/discardchanges', { path: this.repoPath(), all: true })
          .catch((e) => this.server.unhandledRejection(e));
      },
    });
  }

  stashAll() {
    this.server
      .postPromise('/stashes', { path: this.repoPath(), message: this.commitMessageTitle() })
      .catch((e) => this.server.unhandledRejection(e));
  }

  toggleAllStages() {
    const allStageFlag = this.allStageFlag();
    for (const n in this.files()) {
      this.files()[n].editState(allStageFlag ? 'staged' : 'none');
    }
  }

  onEnter(d, e) {
    if (e.keyCode === 13 && !this.commitValidationError()) {
      this.commit();
    }
    return true;
  }

  onAltEnter(d, e) {
    if (e.keyCode === 13 && e.altKey && !this.commitValidationError()) {
      this.commit();
    }
    return true;
  }
}

class FileViewModel {
  constructor(staging, name, oldName, displayName) {
    this.staging = staging;
    this.server = staging.server;
    this.editState = ko.observable('staged'); // staged, patched and none
    this.name = ko.observable(name);
    this.oldName = ko.observable(oldName);
    this.displayName = ko.observable(displayName);
    this.isNew = ko.observable(false);
    this.removed = ko.observable(false);
    this.conflict = ko.observable(false);
    this.renamed = ko.observable(false);
    this.isShowingDiffs = ko.observable(false);
    this.additions = ko.observable('');
    this.deletions = ko.observable('');
    this.modified = ko.computed(() => {
      // only show modfied whe not removed, not conflicted, not new, not renamed
      // and length of additions and deletions is 0.
      return (
        !this.removed() &&
        !this.conflict() &&
        !this.isNew() &&
        this.additions().length === 0 &&
        this.deletions().length === 0
      );
    });
    this.fileType = ko.observable('text');
    this.patchLineList = ko.observableArray();
    this.diff = ko.observable();
    this.isShowPatch = ko.computed(
      () =>
        // if not new file
        // and if not merging
        // and if not rebasing
        // and if text file
        // and if diff is showing, display patch button
        !this.isNew() &&
        !staging.inMerge() &&
        !staging.inRebase() &&
        this.fileType() === 'text' &&
        this.isShowingDiffs()
    );
    this.mergeTool = ko.computed(() => this.conflict() && mergeTool !== false);

    this.editState.subscribe((value) => {
      if (value === 'none') {
        this.patchLineList.removeAll();
      } else if (value === 'patched') {
        if (this.diff().render) this.diff().render();
      }
    });
  }

  getSpecificDiff() {
    return components.create(!this.name() || `${this.fileType()}diff`, {
      filename: this.name(),
      oldFilename: this.oldName(),
      displayFilename: this.displayName(),
      repoPath: this.staging.repoPath,
      server: this.server,
      textDiffType: this.staging.textDiffType,
      whiteSpace: this.staging.whiteSpace,
      isShowingDiffs: this.isShowingDiffs,
      patchLineList: this.patchLineList,
      editState: this.editState,
      wordWrap: this.staging.wordWrap,
    });
  }

  setState(state) {
    this.displayName(state.displayName);
    this.isNew(state.isNew);
    this.removed(state.removed);
    this.conflict(state.conflict);
    this.renamed(state.renamed);
    this.fileType(state.type);
    this.additions(state.additions != '-' ? `+${state.additions}` : '');
    this.deletions(state.deletions != '-' ? `-${state.deletions}` : '');
    if (this.diff()) {
      this.diff().invalidateDiff();
    } else {
      this.diff(this.getSpecificDiff());
    }
    if (this.diff().isNew) this.diff().isNew(state.isNew);
    if (this.diff().isRemoved) this.diff().isRemoved(state.removed);
  }

  toggleStaged() {
    if (this.editState() === 'none') {
      this.editState('staged');
    } else {
      this.editState('none');
    }
    this.patchLineList([]);
  }

  discardChanges() {
    const timeSinceLastMute = new Date().getTime() - this.staging.mutedTime;
    const isMuteWarning = timeSinceLastMute < ungit.config.disableDiscardMuteTime;
    ungit.logger.debug(
      `discard time since mute: ${timeSinceLastMute}, isMuteWarning: ${isMuteWarning}`
    );
    if (ungit.config.disableDiscardWarning || isMuteWarning) {
      this.server
        .postPromise('/discardchanges', { path: this.staging.repoPath(), file: this.name() })
        .catch((e) => this.server.unhandledRejection(e));
    } else {
      components.showModal('yesnomutemodal', {
        title: 'Are you sure you want to discard these changes?',
        details: 'This operation cannot be undone.',
        closeFunc: (isYes, isMute) => {
          if (isYes) {
            this.server
              .postPromise('/discardchanges', { path: this.staging.repoPath(), file: this.name() })
              .catch((e) => this.server.unhandledRejection(e));
          }
          if (isMute) {
            this.staging.mutedTime = new Date().getTime();
          }
        },
      });
    }
  }

  ignoreFile() {
    this.server
      .postPromise('/ignorefile', { path: this.staging.repoPath(), file: this.name() })
      .catch((err) => {
        if (err.errorCode == 'file-already-git-ignored') {
          // The file was already in the .gitignore, so force an update of the staging area (to hopefully clear away this file)
          programEvents.dispatch({ event: 'working-tree-changed' });
        } else {
          this.server.unhandledRejection(err);
        }
      });
  }

  resolveConflict() {
    this.server
      .postPromise('/resolveconflicts', { path: this.staging.repoPath(), files: [this.name()] })
      .catch((e) => this.server.unhandledRejection(e));
  }

  launchMergeTool() {
    this.server
      .postPromise('/launchmergetool', {
        path: this.staging.repoPath(),
        file: this.name(),
        tool: mergeTool,
      })
      .catch((e) => this.server.unhandledRejection(e));
  }

  toggleDiffs() {
    this.isShowingDiffs(!this.isShowingDiffs());
  }

  patchClick() {
    if (!this.isShowingDiffs()) return;

    if (this.editState() === 'patched') {
      this.editState('staged');
    } else {
      this.editState('patched');
    }
  }
}
