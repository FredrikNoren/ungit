var ko = require('knockout');
var inherits = require('util').inherits;
var components = require('ungit-components');
var programEvents = require('ungit-program-events');
var _ = require('lodash');
var filesToDisplayIncrmentBy = 50;
var filesToDisplayLimit = filesToDisplayIncrmentBy;
// when discard button is clicked and disable discard warning is selected, for next 5 minutes disable discard warnings
var muteGraceTimeDuration = 60 * 1000 * 5;
var mergeTool = ungit.config.mergeTool;

components.register('staging', function(args) {
  return new StagingViewModel(args.server, args.repoPath);
});

var StagingViewModel = function(server, repoPath) {
  var self = this;
  this.server = server;
  this.repoPath = repoPath;
  this.filesByPath = {};
  this.files = ko.observableArray();
  this.commitMessageTitleCount = ko.observable(0);
  this.commitMessageTitle = ko.observable();
  this.commitMessageTitle.subscribe(function(value) {
    self.commitMessageTitleCount(value.length);
  });
  this.commitMessageBody = ko.observable();
  this.wordWrap = components.create("textdiff.wordwrap");
  this.textDiffType = components.create('textdiff.type');
  this.whiteSpace = components.create('textdiff.whitespace');
  this.inRebase = ko.observable(false);
  this.inMerge = ko.observable(false);
  this.inCherry = ko.observable(false);
  this.conflictText = ko.computed(function() {
    if (self.inMerge()) {
      self.conflictContinue = self.conflictResolution.bind(self, '/merge/continue', self.conflictContinueProgressBar)
      self.conflictAbort = self.conflictResolution.bind(self, '/merge/abort', self.conflictAbortProgressBar)
      return "Merge";
    } else if (self.inRebase()) {
      self.conflictContinue = self.conflictResolution.bind(self, '/rebase/continue', self.conflictContinueProgressBar)
      self.conflictAbort = self.conflictResolution.bind(self, '/rebase/abort', self.conflictAbortProgressBar)
      return "Rebase";
    } else if (self.inCherry()) {
      self.conflictContinue = self.commit;
      self.conflictAbort = self.discardAllChanges;
      return "Cherry-pick";
    } else {
      self.conflictContinue = undefined;
      self.conflictAbort = undefined;
      return undefined;
    }
  });
  this.allStageFlag = ko.observable(false);
  this.HEAD = ko.observable();
  this.isStageValid = ko.computed(function() {
    return !self.inRebase() && !self.inMerge() && !self.inCherry();
  });
  this.nFiles = ko.computed(function() {
    return self.files().length;
  });
  this.nStagedFiles = ko.computed(function() {
    return self.files().filter(function(f) { return f.editState() === 'staged'; }).length;
  });
  this.stats = ko.computed(function() {
    return self.nFiles() + ' files, ' + self.nStagedFiles() + ' to be commited';
  });
  this.amend = ko.observable(false);
  this.canAmend = ko.computed(function() {
    return self.HEAD() && !self.inRebase() && !self.inMerge();
  });
  this.canStashAll = ko.computed(function() {
    return !self.amend();
  });
  this.showNux = ko.computed(function() {
    return self.files().length == 0 && !self.amend() && !self.inRebase();
  });
  this.committingProgressBar = components.create('progressBar', { predictionMemoryKey: 'committing-' + this.repoPath(), temporary: true });
  this.conflictContinueProgressBar = components.create('progressBar', { predictionMemoryKey: 'conflict-continue-' + this.repoPath(), temporary: true });
  this.conflictAbortProgressBar = components.create('progressBar', { predictionMemoryKey: 'conflict-abort-' + this.repoPath(), temporary: true });
  this.stashProgressBar = components.create('progressBar', { predictionMemoryKey: 'stash-' + this.repoPath(), temporary: true });
  this.commitValidationError = ko.computed(function() {
    if (!self.amend() && !self.files().some(function(file) { return file.editState() === 'staged' || file.editState() === 'patched'; }))
      return "No files to commit";

    if (self.files().some(function(file) { return file.conflict(); }))
      return "Files in conflict";

    if (!self.commitMessageTitle() && !self.inRebase()) return "Provide a title";

    if (self.textDiffType.value() === 'sidebysidediff') {
      var patchFiles = self.files().filter(function(file) { return file.editState() === 'patched'; });
      if (patchFiles.length > 0) return "Cannot patch with side by side view."
    }

    return "";
  });
  this.toggleSelectAllGlyphClass = ko.computed(function() {
    if (self.allStageFlag()) return 'glyphicon-unchecked';
    else return 'glyphicon-check';
  });

  this.refreshContentThrottled = _.throttle(this.refreshContent.bind(this), 400, { trailing: true });
  this.invalidateFilesDiffsThrottled = _.throttle(this.invalidateFilesDiffs.bind(this), 400, { trailing: true });
  this.refreshContentThrottled();
  if (window.location.search.indexOf('noheader=true') >= 0)
    this.refreshButton = components.create('refreshbutton');
  this.loadAnyway = false;
  this.isDiagOpen = false;
  this.mutedTime = null;
}
StagingViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('staging', this, {}, parentElement);
}
StagingViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'request-app-content-refresh') {
    this.refreshContent();
    this.invalidateFilesDiffs();
  }
  if (event.event == 'working-tree-changed') {
    this.refreshContentThrottled();
    this.invalidateFilesDiffsThrottled();
  }
}
StagingViewModel.prototype.refreshContent = function(callback) {
  var self = this;
  this.server.get('/head', { path: this.repoPath(), limit: 1 }, function(err, log) {
    if (err) {
      return err.errorCode == 'must-be-in-working-tree' ||
        err.errorCode == 'no-such-path';
    }
    if (log.length > 0) {
      var array = log[0].message.split('\n');
      self.HEAD({title: array[0], body: array.slice(2).join('\n')});
    }
    else self.HEAD(null);
  });
  this.server.get('/status', { path: this.repoPath(), fileLimit: filesToDisplayLimit }, function(err, status) {
    if (err) {
      if (callback) callback(err);
      return err.errorCode == 'must-be-in-working-tree' ||
        err.errorCode == 'no-such-path';
    }

    if (Object.keys(status.files).length > filesToDisplayLimit && !self.loadAnyway) {
      if (self.isDiagOpen) {
        if (callback) callback();
        return;
      }
      self.isDiagOpen = true;
      var diag = components.create('TooManyFilesDialogViewModel', { title: 'Too many unstaged files', details: 'It is recommended to use command line as ungit may be too slow.'});

      diag.closed.add(function() {
        self.isDiagOpen = false;
        if (diag.result()) {
          self.loadAnyway = true;
          self.loadStatus(status, callback);
        } else {
          window.location.href = '/#/';
        }
      })

      programEvents.dispatch({ event: 'request-show-dialog', dialog: diag });
    } else {
      self.loadStatus(status, callback);
    }
  });
}
StagingViewModel.prototype.loadStatus = function(status, callback) {
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
    var lines = status.commitMessage.split('\n');
    this.commitMessageTitle(lines[0]);
    this.commitMessageBody(lines.slice(1).join('\n'));
  }
  if (callback) callback();
}
StagingViewModel.prototype.setFiles = function(files) {
  var self = this;
  var newFiles = [];
  for(var file in files) {
    var fileViewModel = this.filesByPath[file];
    if (!fileViewModel) {
      this.filesByPath[file] = fileViewModel = new FileViewModel(self, file);
    } else {
      // this is mainly for patching and it may not fire due to the fact that
      // '/commit' triggers working-tree-changed which triggers throttled refresh
      fileViewModel.invalidateDiff();
    }
    fileViewModel.setState(files[file]);
    newFiles.push(fileViewModel);
  }
  this.files(newFiles);
  programEvents.dispatch({ event: 'init-tooltip' });
}
StagingViewModel.prototype.toggleAmend = function() {
  if (!this.amend() && !this.commitMessageTitle()) {
    this.commitMessageTitle(this.HEAD().title);
    this.commitMessageBody(this.HEAD().body);
  }
  else if(this.amend()) {
    var isPrevDefaultMsg =
      this.commitMessageTitle() == this.HEAD().title &&
      this.commitMessageBody() == this.HEAD().body;
    if (isPrevDefaultMsg) {
      this.commitMessageTitle('');
      this.commitMessageBody('');
    }
  }
  this.amend(!this.amend());
}
StagingViewModel.prototype.resetMessages = function() {
  this.commitMessageTitle('');
  this.commitMessageBody('');
  this.amend(false);
}
StagingViewModel.prototype.commit = function() {
  var self = this;
  this.committingProgressBar.start();
  var files = this.files().filter(function(file) {
    return file.editState() !== 'none';
  }).map(function(file) {
    return { name: file.name(), patchLineList: file.editState() === 'patched' ? file.patchLineList() : null };
  });
  var commitMessage = this.commitMessageTitle();
  if (this.commitMessageBody()) commitMessage += '\n\n' + this.commitMessageBody();
  this.server.post('/commit', { path: this.repoPath(), message: commitMessage, files: files, amend: this.amend() }, function(err, res) {
    self.committingProgressBar.stop();
    if (err) {
      return;
    }
    self.resetMessages();
    self.files([]);
  });
}
StagingViewModel.prototype.conflictResolution = function(apiPath, progressBar) {
  var self = this;
  progressBar.start();
  var commitMessage = this.commitMessageTitle();
  if (this.commitMessageBody()) commitMessage += '\n\n' + this.commitMessageBody();
  this.server.post(apiPath, { path: this.repoPath(), message: commitMessage }, function(err, res) {
    self.resetMessages();
    progressBar.stop();
  });
}
StagingViewModel.prototype.invalidateFilesDiffs = function() {
  this.files().forEach(function(file) {
    file.diff().invalidateDiff();
  });
}
StagingViewModel.prototype.discardAllChanges = function() {
  var self = this;
  var diag = components.create('yesnodialog', { title: 'Are you sure you want to discard all changes?', details: 'This operation cannot be undone.'});
  diag.closed.add(function() {
    if (diag.result()) self.server.post('/discardchanges', { path: self.repoPath(), all: true });
  });
  programEvents.dispatch({ event: 'request-show-dialog', dialog: diag });
}
StagingViewModel.prototype.stashAll = function() {
  var self = this;
  this.stashProgressBar.start();
  this.server.post('/stashes', { path: this.repoPath(), message: this.commitMessageTitle() }, function(err, res) {
    self.stashProgressBar.stop();
  });
}
StagingViewModel.prototype.toggleAllStages = function() {
  var self = this;
  for (var n in self.files()){
    self.files()[n].editState(self.allStageFlag() ? 'staged' : 'none');
  }

  self.allStageFlag(!self.allStageFlag());
}
StagingViewModel.prototype.onEnter = function(d, e){
    if (e.keyCode === 13 && !this.commitValidationError()) {
      this.commit();
    }
    return true;
};
StagingViewModel.prototype.onAltEnter = function(d, e){
    if (e.keyCode === 13 && e.altKey && !this.commitValidationError()) {
      this.commit();
    }
    return true;
};

var FileViewModel = function(staging, name) {
  var self = this;
  this.staging = staging;
  this.server = staging.server;
  this.editState = ko.observable('staged'); // staged, patched and none
  this.name = ko.observable(name);
  this.displayName = ko.observable(name);
  this.isNew = ko.observable(false);
  this.removed = ko.observable(false);
  this.conflict = ko.observable(false);
  this.renamed = ko.observable(false);
  this.isShowingDiffs = ko.observable(false);
  this.diffProgressBar = components.create('progressBar', { predictionMemoryKey: 'diffs-' + this.staging.repoPath(), temporary: true });
  this.additions = ko.observable('');
  this.deletions = ko.observable('');
  this.fileType = ko.observable('text');
  this.patchLineList = ko.observableArray();
  this.diff = ko.observable();
  this.isShowPatch = ko.computed(function() {
    // if not new file
    // and if not merging
    // and if not rebasing
    // and if text file
    // and if diff is showing, display patch button
    return !self.isNew() && !staging.inMerge() && !staging.inRebase() && self.fileType() === 'text' && self.isShowingDiffs();
  });
  this.mergeTool = ko.computed(function() {
    return self.conflict() && mergeTool !== false;
  });

  this.editState.subscribe(function (value) {
    if (value === 'none') {
      self.patchLineList([]);
    } else if (value === 'patched') {
      if (self.diff().render) self.diff().render();
    }
  });
}
FileViewModel.prototype.getSpecificDiff = function() {
  return components.create(!this.name() || this.fileType() + 'diff', {
    filename: this.name(),
    repoPath: this.staging.repoPath,
    server: this.server,
    textDiffType: this.staging.textDiffType,
    whiteSpace: this.staging.whiteSpace,
    isShowingDiffs: this.isShowingDiffs,
    diffProgressBar: this.diffProgressBar,
    patchLineList: this.patchLineList,
    editState: this.editState,
    wordWrap: this.staging.wordWrap
  });
}
FileViewModel.prototype.setState = function(state) {
  this.displayName(state.displayName);
  this.isNew(state.isNew);
  this.removed(state.removed);
  this.conflict(state.conflict);
  this.renamed(state.renamed);
  this.fileType(state.type);
  this.additions(state.additions != '-' ? '+' + state.additions : '');
  this.deletions(state.deletions != '-' ? '-' + state.deletions : '');
  this.diff = ko.observable(this.getSpecificDiff());
  if (this.diff().isNew) this.diff().isNew(state.isNew);
  if (this.diff().isRemoved) this.diff().isRemoved(state.removed);
}
FileViewModel.prototype.toggleStaged = function() {
  if (this.editState() === 'none') {
    this.editState('staged');
  } else {
    this.editState('none');
  }
  this.patchLineList([]);
}
FileViewModel.prototype.discardChanges = function() {
  var self = this;
  if (ungit.config.disableDiscardWarning || new Date().getTime() - this.staging.mutedTime < ungit.config.disableDiscardMuteTime) {
    self.server.post('/discardchanges', { path: self.staging.repoPath(), file: self.name() });
  } else {
    var diag = components.create('yesnomutedialog', { title: 'Are you sure you want to discard these changes?', details: 'This operation cannot be undone.'});
    diag.closed.add(function() {
      if (diag.result()) self.server.post('/discardchanges', { path: self.staging.repoPath(), file: self.name() });
      if (diag.result() === "mute") self.staging.mutedTime = new Date().getTime();
    });
    programEvents.dispatch({ event: 'request-show-dialog', dialog: diag });
  }
}
FileViewModel.prototype.ignoreFile = function() {
  var self = this;
  this.server.post('/ignorefile', { path: this.staging.repoPath(), file: this.name() }, function(err) {
    if (err && err.errorCode == 'file-already-git-ignored') {
      // The file was already in the .gitignore, so force an update of the staging area (to hopefull clear away this file)
      programEvents.dispatch({ event: 'working-tree-changed' });
      return true;
    }
  });
}
FileViewModel.prototype.resolveConflict = function() {
  this.server.post('/resolveconflicts', { path: this.staging.repoPath(), files: [this.name()] });
}
FileViewModel.prototype.launchMergeTool = function() {
  this.server.post('/launchmergetool', { path: this.staging.repoPath(), file: this.name(), tool: mergeTool });
}
FileViewModel.prototype.toggleDiffs = function() {
  if (this.renamed()) return; // do not show diffs for renames
  if (this.isShowingDiffs()) {
    this.isShowingDiffs(false);
  } else {
    this.isShowingDiffs(true);
    this.invalidateDiff();
  }
}
FileViewModel.prototype.patchClick = function() {
  if (!this.isShowingDiffs()) return;

  if (this.editState() === 'patched') {
    this.editState('staged');
  } else {
    this.editState('patched');
  }
}
FileViewModel.prototype.invalidateDiff = function() {
  this.diff().invalidateDiff();
}
