const ko = require('knockout');
const _ = require('lodash');
const octicons = require('octicons');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const filesToDisplayIncrmentBy = 250;
const filesToDisplayLimit = filesToDisplayIncrmentBy;
const mergeTool = ungit.config.mergeTool;
const { ComponentRoot } = require('../ComponentRoot');

// when in staging mode, checkmark means "in index". Otherwise it means "will commit"
// patching or having a non-empty index means staging mode
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
    this.indexByPath = {};
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
    this.conflictText = ko.pureComputed(() => {
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
    this.isStageValid = ko.pureComputed(
      () => !this.inRebase() && !this.inMerge() && !this.inCherry()
    );
    this.nFiles = ko.pureComputed(() => this.files().length);
    this.nStagedFiles = ko.pureComputed(
      () => this.files().filter((f) => f.editState() === 'staged').length
    );
    this.allStageFlag = ko.pureComputed(() => this.nFiles() !== this.nStagedFiles());
    this.useStaging = ko.observable(false);
    this.stats = ko.pureComputed(
      () =>
        `${
          this.useStaging() ? '[STAGING MODE]' : ''
        } ${this.nFiles()} files, ${this.nStagedFiles()} to be commited`
    );
    this.amend = ko.observable(false);
    this.canAmend = ko.pureComputed(
      () => this.HEAD() && !this.inRebase() && !this.inMerge() && !this.emptyCommit()
    );
    this.emptyCommit = ko.observable(false);
    this.canEmptyCommit = ko.pureComputed(() => this.HEAD() && !this.inRebase() && !this.inMerge());
    this.canStashAll = ko.pureComputed(() => !this.amend());
    this.canPush = ko.pureComputed(() => !!this.graph.currentRemote());
    this.showNux = ko.pureComputed(
      () => this.files().length == 0 && !this.amend() && !this.inRebase() && !this.emptyCommit()
    );
    this.showCancelButton = ko.pureComputed(() => this.amend() || this.emptyCommit());
    this.commitValidationError = ko.pureComputed(() => {
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
    this.toggleSelectAllGlyphClass = ko.pureComputed(() => {
      if (this.allStageFlag()) return 'glyphicon-unchecked';
      else return 'glyphicon-check';
    });

    this.refreshContentThrottled = _.throttle(this.refreshContent.bind(this), 200, {
      leading: false,
      trailing: true,
    });
    this.invalidateFilesDiffsThrottled = _.throttle(this.invalidateFilesDiffs.bind(this), 200, {
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
      const head = await headPromise;
      if (head) {
        const array = head.message.split('\n');
        // TODO handle single newline after title
        this.HEAD({ title: array[0], body: array.slice(2).join('\n') });
      } else {
        this.HEAD(null);
      }

      /** @type {GitStatus} */
      const status = await statusPromise;
      if (this.isSamePayload(status)) {
        return;
      }

      if (status.worktree.fileLineDiffs.length > filesToDisplayLimit && !this.loadAnyway) {
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

  loadStatus(/** @type {GitStatus} */ status) {
    const { index, worktree } = status;
    let files;
    if (index.fileLineDiffs.length) {
      this.useStaging(true);
      files = [...this.makeFiles(index, true), ...this.makeFiles(worktree, false)];
    } else {
      files = this.makeFiles(worktree);
    }
    files.sort((a, b) => (a.sortName > b.sortName ? 1 : a.sortName < b.sortName ? -1 : 0));
    this.files(files);

    this.inRebase(!!status.inRebase);
    this.inMerge(!!status.inMerge);
    // There are time where '.git/CHERRY_PICK_HEAD' file is created and no files are in conflicts.
    // in such cases we should ignore exception as no good way to resolve it.
    this.inCherry(!!status.inCherry && !!status.inConflict);

    if (status.commitMessage && !this.commitMessageTitle()) {
      const lines = status.commitMessage.split('\n');
      if (lines[0] && lines[0][0] !== '#') {
        this.commitMessageTitle(lines[0]);
        this.commitMessageBody(lines.slice(1).join('\n'));
      } else {
        this.commitMessageBody(lines.join('\n'));
      }
    }
  }

  makeFiles(/** @type {DiffStatTotal} */ stats, inIndex) {
    const newFiles = [];
    for (const fileStatus of stats.fileLineDiffs) {
      const filesByPath = inIndex ? this.indexByPath : this.filesByPath;
      const { fileName, oldFileName } = fileStatus;
      const name = fileName ? `N${fileName}` : `O${oldFileName}`;
      /** @type {FileViewModel} */
      let fileViewModel = filesByPath[name];
      if (!fileViewModel) {
        filesByPath[name] = fileViewModel = new FileViewModel(
          this,
          fileStatus,
          stats.diffKey,
          inIndex
        );
      } else {
        fileViewModel.updateFrom(fileStatus, stats.diffKey);
      }
      newFiles.push(fileViewModel);
    }
    return newFiles;
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
    // TODO - perhaps better just redownload
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
  constructor(staging, /** @type {DiffStat} */ stat, diffKey, inIndex) {
    /** @type {StagingViewModel} */
    this.staging = staging;
    this.server = staging.server;
    this.idx = stat.idx;
    this.diffKey = diffKey;
    this.stat = ko.observable(stat);
    const editState = inIndex || !this.staging.useStaging() ? 'staged' : 'none';
    this.editState = ko.observable(editState); // staged, patched and none
    this.isPending = ko.observable(false);
    this.isShowingDiffs = ko.observable(false);

    this.name = ko.pureComputed(() => this.stat().fileName);
    this.oldName = ko.pureComputed(() => this.stat().oldFileName);

    this.displayName = ko.pureComputed(() =>
      this.name()
        ? this.oldName()
          ? this.oldName() !== this.name()
            ? `${this.oldName()} → ${this.name()}`
            : this.name()
          : `[new] ${this.name()}`
        : `[del] ${this.oldName()}`
    );
    this.sortName = ko.pureComputed(() => this.displayName().toLocaleLowerCase());
    this.isNew = ko.pureComputed(() => !this.oldName());
    this.removed = ko.pureComputed(() => !this.name());
    this.conflict = ko.pureComputed(() => !!this.stat().hasConflict);
    this.renamed = ko.pureComputed(
      () => !!(this.name() && this.oldName() && this.name() !== this.oldName())
    );
    this.additions = ko.pureComputed(() =>
      this.stat().additions ? `+${this.stat().additions}` : ''
    );
    this.deletions = ko.pureComputed(() =>
      this.stat().deletions ? `-${this.stat().deletions}` : ''
    );
    this.modified = ko.pureComputed(() => {
      // only show modfied whe not removed, not conflicted, not new, not renamed
      // and length of additions and deletions is 0.
      return (
        !this.removed() &&
        !this.conflict() &&
        !this.isNew() &&
        !this.additions() &&
        !this.deletions()
      );
    });
    this.fileType = ko.pureComputed(() => this.stat().type);
    this.patchLineList = ko.observableArray();
    this.diff = ko.observable(this.getSpecificDiff());
    this.isShowPatch = ko.pureComputed(
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

  updateFrom(/** @type {DiffStat} */ stat, diffKey) {
    this.idx = stat.idx;
    this.diffKey = diffKey;
    // this is mainly for patching and it may not fire due to the fact that
    // '/commit' triggers working-tree-changed which triggers throttled refresh
    this.diff().invalidateDiff();
    this.stat(stat);
  }

  getSpecificDiff() {
    return components.create(`${this.fileType()}diff`, {
      repoPath: this.staging.repoPath,

      diffKey: this.diffKey,
      idx: this.idx,

      filename: this.name(),
      oldFilename: this.oldName(),

      isNew: this.isNew(),
      removed: this.removed(),
      conflict: this.conflict(),

      server: this.server,
      textDiffType: this.staging.textDiffType,
      whiteSpace: this.staging.whiteSpace,
      isShowingDiffs: this.isShowingDiffs,
      patchLineList: this.patchLineList,
      editState: this.editState,
      wordWrap: this.staging.wordWrap,
    });
  }

  async toggleStaged() {
    if (this.editState() === 'none') {
      if (this.staging.useStaging()) {
        await this.server.postPromise('/stage', {
          path: this.staging.repoPath(),
          file: this.name() || this.oldName(),
        });
      }
      this.editState('staged');
    } else {
      if (this.staging.useStaging()) {
        await this.server.postPromise('/unstage', {
          path: this.staging.repoPath(),
          file: this.name() || this.oldName(),
        });
      }
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
        .postPromise('/discardchanges', {
          path: this.staging.repoPath(),
          file: this.name() || this.oldName(),
        })
        .catch((e) => this.server.unhandledRejection(e));
    } else {
      components.showModal('yesnomutemodal', {
        title: 'Are you sure you want to discard these changes?',
        details: 'This operation cannot be undone.',
        closeFunc: (isYes, isMute) => {
          if (isYes) {
            this.server
              .postPromise('/discardchanges', {
                path: this.staging.repoPath(),
                file: this.name() || this.oldName(),
              })
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
      .postPromise('/ignorefile', {
        path: this.staging.repoPath(),
        file: this.name() || this.oldName(),
      })
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
      .postPromise('/resolveconflicts', {
        path: this.staging.repoPath(),
        files: [this.name() || this.oldName()],
      })
      .catch((e) => this.server.unhandledRejection(e));
  }

  launchMergeTool() {
    this.server
      .postPromise('/launchmergetool', {
        path: this.staging.repoPath(),
        file: this.name() || this.oldName(),
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
