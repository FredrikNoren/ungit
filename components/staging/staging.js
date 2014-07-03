
var ko = require('knockout');
var inherits = require('util').inherits;
var components = require('ungit-components');
var programEvents = require('ungit-program-events');
var _ = require('lodash');

components.register('staging', function(args) {
  return new StagingViewModel(args.server, args.repoPath);
});

var StagingViewModel = function(server, repoPath) {
  var self = this;
  this.server = server;
  this.repoPath = repoPath;
  this.filesByPath = {};
  this.files = ko.observable([]);
  this.commitMessageTitleCount = ko.observable(0);
  this.commitMessageTitle = ko.observable();
  this.commitMessageTitle.subscribe(function(value) {
    self.commitMessageTitleCount(value.length);
  });
  this.commitMessageBody = ko.observable();
  this.inRebase = ko.observable(false);
  this.inMerge = ko.observable(false);
  this.allStageFlag = ko.observable(false);
  this.HEAD = ko.observable();
  this.commitButtonVisible = ko.computed(function() {
    return !self.inRebase() && !self.inMerge();
  });
  this.nFiles = ko.computed(function() {
    return self.files().length;
  });
  this.nStagedFiles = ko.computed(function() {
    return self.files().filter(function(f) { return f.staged(); }).length;
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
  this.committingProgressBar = components.create('progressBar', { predictionMemoryKey: 'committing-' + this.repoPath, temporary: true });
  this.rebaseContinueProgressBar = components.create('progressBar', { predictionMemoryKey: 'rebase-continue-' + this.repoPath, temporary: true });
  this.rebaseAbortProgressBar = components.create('progressBar', { predictionMemoryKey: 'rebase-abort-' + this.repoPath, temporary: true });
  this.mergeContinueProgressBar = components.create('progressBar', { predictionMemoryKey: 'merge-continue-' + this.repoPath, temporary: true });
  this.mergeAbortProgressBar = components.create('progressBar', { predictionMemoryKey: 'merge-abort-' + this.repoPath, temporary: true });
  this.stashProgressBar = components.create('progressBar', { predictionMemoryKey: 'stash-' + this.repoPath, temporary: true });
  this.commitValidationError = ko.computed(function() {
    if (!self.amend() && !self.files().some(function(file) { return file.staged(); }))
      return "No files to commit";

    if (self.files().some(function(file) { return file.conflict(); }))
      return "Files in conflict";

    if (!self.commitMessageTitle() && !self.inRebase()) return "Provide a title";
    return "";
  });
  this.toggleSelectAllGlyphClass = ko.computed(function() {
    if (self.allStageFlag()) return 'glyphicon-unchecked';
    else return 'glyphicon-check';
  });

  this.refreshContentThrottled = _.throttle(this.refreshContent.bind(this), 400, { trailing: true });
  this.invalidateFilesDiffsThrottled = _.throttle(this.invalidateFilesDiffs.bind(this), 400, { trailing: true });
  this.refreshContentThrottled();
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
  this.server.get('/head', { path: this.repoPath, limit: 1 }, function(err, log) {
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
  this.server.get('/status', { path: this.repoPath }, function(err, status) {
    if (err) {
      if (callback) callback(err);
      return err.errorCode == 'must-be-in-working-tree' ||
        err.errorCode == 'no-such-path';
    }
    self.setFiles(status.files);
    self.inRebase(!!status.inRebase);
    self.inMerge(!!status.inMerge);
    if (status.inMerge) {
      var lines = status.commitMessage.split('\n');
      self.commitMessageTitle(lines[0]);
      self.commitMessageBody(lines.slice(1).join('\n'));
    }
    if (callback) callback();
  });
}
StagingViewModel.prototype.setFiles = function(files) {
  var self = this;
  var newFiles = [];
  for(var file in files) {
    var fileViewModel = this.filesByPath[file];
    if (!fileViewModel) {
      this.filesByPath[file] = fileViewModel = new FileViewModel(self, file, files[file].type);
    }
    fileViewModel.setState(files[file]);
    fileViewModel.invalidateDiff();
    newFiles.push(fileViewModel);
  }
  this.files(newFiles);
}
StagingViewModel.prototype.toogleAmend = function() {
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
StagingViewModel.prototype.commit = function() {
  var self = this;
  this.committingProgressBar.start();
  var files = this.files().filter(function(file) {
    return file.staged();
  }).map(function(file) {
    return file.name();
  });
  var commitMessage = this.commitMessageTitle();
  if (this.commitMessageBody()) commitMessage += '\n\n' + this.commitMessageBody();
  this.server.post('/commit', { path: this.repoPath, message: commitMessage, files: files, amend: this.amend() }, function(err, res) {
    if (err) {
      return;
    }
    self.commitMessageTitle('');
    self.commitMessageBody('');
    self.amend(false);
    self.files([]);
    self.committingProgressBar.stop();
  });
}
StagingViewModel.prototype.rebaseContinue = function() {
  var self = this;
  this.rebaseContinueProgressBar.start();
  this.server.post('/rebase/continue', { path: this.repoPath }, function(err, res) {
    self.rebaseContinueProgressBar.stop();
  });
}
StagingViewModel.prototype.rebaseAbort = function() {
  var self = this;
  this.rebaseAbortProgressBar.start();
  this.server.post('/rebase/abort', { path: this.repoPath }, function(err, res) {
    self.rebaseAbortProgressBar.stop();
  });
}
StagingViewModel.prototype.mergeContinue = function() {
  var self = this;
  this.mergeContinueProgressBar.start();
  var commitMessage = this.commitMessageTitle();
  if (this.commitMessageBody()) commitMessage += '\n\n' + this.commitMessageBody();
  this.server.post('/merge/continue', { path: this.repoPath, message: commitMessage }, function(err, res) {
    self.mergeContinueProgressBar.stop();
  });
}
StagingViewModel.prototype.mergeAbort = function() {
  var self = this;
  this.mergeAbortProgressBar.start();
  this.server.post('/merge/abort', { path: this.repoPath }, function(err, res) {
    self.mergeAbortProgressBar.stop();
  }); 
}
StagingViewModel.prototype.invalidateFilesDiffs = function() {
  this.files().forEach(function(file) {
    file.invalidateDiff(false);
  });
}
StagingViewModel.prototype.discardAllChanges = function() {
  var self = this;
  var diag = components.create('yesnodialog', { title: 'Are you sure you want to discard all changes?', details: 'This operation cannot be undone.'});
  diag.closed.add(function() {
    if (diag.result()) self.server.post('/discardchanges', { path: self.repoPath, all: true });
  });
  programEvents.dispatch({ event: 'request-show-dialog', dialog: diag });
}
StagingViewModel.prototype.stashAll = function() {
  var self = this;
  this.stashProgressBar.start();
  this.server.post('/stashes', { path: this.repoPath, message: this.commitMessageTitle() }, function(err, res) {
    self.stashProgressBar.stop();
  });
}
StagingViewModel.prototype.toogleAllStages = function() {
  var self = this;
  for (var n in self.files()){
    self.files()[n].staged(self.allStageFlag());
  }

  self.allStageFlag(!self.allStageFlag());
}

var FileViewModel = function(staging, name, type) {
  var self = this;
  this.staging = staging;
  this.server = staging.server;
  this.type = ko.observable(type);
  this.staged = ko.observable(true);
  this.name = ko.observable(name);
  this.isNew = ko.observable(false);
  this.removed = ko.observable(false);
  this.conflict = ko.observable(false);
  this.showingDiffs = ko.observable(false);
  this.diffsProgressBar = components.create('progressBar', { predictionMemoryKey: 'diffs-' + this.staging.repoPath, temporary: true });
  this.diff = ko.observable(components.create(this.type() == 'image' ? 'imagediff' : 'textdiff', {
      filename: this.name(),
      repoPath: this.staging.repoPath,
      server: this.server
    }));
}
FileViewModel.prototype.setState = function(state) {
  this.isNew(state.isNew);
  this.removed(state.removed);
  this.conflict(state.conflict);
  if (this.diff().isNew) this.diff().isNew(state.isNew);
  if (this.diff().isRemoved) this.diff().isRemoved(state.removed);
}
FileViewModel.prototype.toogleStaged = function() {
  this.staged(!this.staged());
}
FileViewModel.prototype.discardChanges = function() {
  this.server.post('/discardchanges', { path: this.staging.repoPath, file: this.name() });
}
FileViewModel.prototype.ignoreFile = function() {
  var self = this;
  this.server.post('/ignorefile', { path: this.staging.repoPath, file: this.name() }, function(err) {
    if (err && err.errorCode == 'file-already-git-ignored') {
      // The file was already in the .gitignore, so force an update of the staging area (to hopefull clear away this file)
      programEvents.dispatch({ event: 'working-tree-changed' });
      return true;
    } 
  });
}
FileViewModel.prototype.resolveConflict = function() {
  this.server.post('/resolveconflicts', { path: this.staging.repoPath, files: [this.name()] });
}
FileViewModel.prototype.toogleDiffs = function() {
  var self = this;
  if (this.showingDiffs()) this.showingDiffs(false);
  else {
    this.showingDiffs(true);
    this.invalidateDiff(true);
  }
}
FileViewModel.prototype.invalidateDiff = function(drawProgressBar) {
  var self = this;
  if (this.showingDiffs() && (drawProgressBar || this.type != 'image')) {
    this.diffsProgressBar.start();
    this.diff().invalidateDiff(function() {
      self.diffsProgressBar.stop();
    });
  }
}

 
