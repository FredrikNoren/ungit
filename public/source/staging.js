
var ko = require('../vendor/js/knockout-2.2.1');
var ProgressBarViewModel = require('./controls').ProgressBarViewModel;
var screens = require('./screens');
var dialogs = require('./dialogs');
var inherits = require('util').inherits;

var StagingViewModel = function(repository) {
	var self = this;
	this.repository = repository;
	this.app =repository.app;
	this.repoPath = this.repository.repoPath;
	this.filesByPath = {};
	this.files = ko.observable([]);
	this.commitMessageTitle = ko.observable();
	this.commitMessageBody = ko.observable();
	this.inRebase = ko.observable(false);
	this.inMerge = ko.observable(false);
	this.allStageFlag = false;
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
		return self.repository.graph.HEAD() && !self.inRebase() && !self.inMerge();
	});
	this.showNux = ko.computed(function() {
		return self.files().length == 0 && !self.amend();
	});
	this.refreshingProgressBar = new ProgressBarViewModel('refreshing-' + repository.repoPath);
	this.committingProgressBar = new ProgressBarViewModel('committing-' + repository.repoPath);
	this.rebaseContinueProgressBar = new ProgressBarViewModel('rebase-continue-' + repository.repoPath);
	this.rebaseAbortProgressBar = new ProgressBarViewModel('rebase-abort-' + repository.repoPath);
	this.mergeContinueProgressBar = new ProgressBarViewModel('merge-continue-' + repository.repoPath);
	this.mergeAbortProgressBar = new ProgressBarViewModel('merge-abort-' + repository.repoPath);
	this.commitValidationError = ko.computed(function() {
		if (!self.amend() && !self.files().some(function(file) { return file.staged(); }))
			return "No files to commit";

		if (self.files().some(function(file) { return file.conflict(); }))
			return "Files in conflict";

		if (!self.commitMessageTitle() && !self.inRebase()) return "Provide a title";
		return "";
	});
}
exports.StagingViewModel = StagingViewModel;
StagingViewModel.prototype.refresh = function() {
	var self = this;
	this.refreshingProgressBar.start();
	this.app.get('/status', { path: this.repoPath }, function(err, status) {
		self.refreshingProgressBar.stop();
		if (err) return;
		self.setFiles(status.files);
		self.inRebase(!!status.inRebase);
		self.inMerge(!!status.inMerge);
		if (status.inMerge) {
			var lines = status.commitMessage.split('\n');
			self.commitMessageTitle(lines[0]);
			self.commitMessageBody(lines.slice(1).join('\n'));
		}
	});
}
StagingViewModel.prototype.setFiles = function(files) {
	var self = this;
	var newFiles = [];
	for(var file in files) {
		var fileViewModel = this.filesByPath[file];
		if (!fileViewModel) {
			this.filesByPath[file] = fileViewModel = new FileViewModel(self, files[file].type);
			fileViewModel.name(file);
		}
		fileViewModel.isNew(files[file].isNew);
		fileViewModel.removed(files[file].removed);
		fileViewModel.conflict(files[file].conflict);
		fileViewModel.invalidateDiff();
		newFiles.push(fileViewModel);
	}
	this.files(newFiles);
}
StagingViewModel.prototype.toogleAmend = function() {
	if (!this.amend() && !this.commitMessageTitle()) {
		this.commitMessageTitle(this.repository.graph.HEAD().title());
		this.commitMessageBody(this.repository.graph.HEAD().body());
	}
	else if(this.amend()) {
		this.commitMessageTitle('');
		this.commitMessageBody('');
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
	this.app.post('/commit', { path: this.repository.repoPath, message: commitMessage, files: files, amend: this.amend() }, function(err, res) {
		if (err) {
			if (err.errorCode == 'no-git-name-email-configured') {
				self.repository.app.content(new screens.UserErrorViewModel({
					title: 'Git email and/or name not configured',
					details: 'You need to configure your git email and username to commit files.<br> Run <code>git config --global user.name "your name"</code> and <code>git config --global user.email "your@email.com"</code>'
				}));
				return true;
			}
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
	this.app.post('/rebase/continue', { path: this.repository.repoPath }, function(err, res) {
		self.rebaseContinueProgressBar.stop();
	});
}
StagingViewModel.prototype.rebaseAbort = function() {
	var self = this;
	this.rebaseAbortProgressBar.start();
	this.app.post('/rebase/abort', { path: this.repository.repoPath }, function(err, res) {
		self.rebaseAbortProgressBar.stop();
	});
}
StagingViewModel.prototype.mergeContinue = function() {
	var self = this;
	this.mergeContinueProgressBar.start();
	var commitMessage = this.commitMessageTitle();
	if (this.commitMessageBody()) commitMessage += '\n\n' + this.commitMessageBody();
	this.app.post('/merge/continue', { path: this.repository.repoPath, message: commitMessage }, function(err, res) {
		self.mergeContinueProgressBar.stop();
	});
}
StagingViewModel.prototype.mergeAbort = function() {
	var self = this;
	this.mergeAbortProgressBar.start();
	this.app.post('/merge/abort', { path: this.repository.repoPath }, function(err, res) {
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
	var diag = new dialogs.YesNoDialogViewModel('Are you sure you want to discard all changes?', 'This operation cannot be undone.');
	diag.closed.add(function() {
		if (diag.result()) self.app.post('/discardchanges', { path: self.repository.repoPath, all: true });
	});
	this.app.showDialog(diag);
}
StagingViewModel.prototype.toogleAllStages = function() {
	var self = this;
	for (var n in self.files()){
		self.files()[n].staged(self.allStageFlag);
	}
	self.allStageFlag = !self.allStageFlag
}

var FileViewModel = function(staging, type) {
	var self = this;
	this.staging = staging;
	this.app = staging.app;
	this.type = type;
	this.imageDiff = new ImageDiffViewModel(this);
	this.fileDiff = new LineByLineDiffViewModel(this);
	this.staged = ko.observable(true);
	this.name = ko.observable();
	this.isNew = ko.observable(false);
	this.removed = ko.observable(false);
	this.conflict = ko.observable(false);
	this.diffs = ko.observable([]);
	this.showingDiffs = ko.observable(false);
	this.diffsProgressBar = new ProgressBarViewModel('diffs-' + this.staging.repository.repoPath);
}
FileViewModel.prototype.toogleStaged = function() {
	this.staged(!this.staged());
}
FileViewModel.prototype.discardChanges = function() {
	this.app.post('/discardchanges', { path: this.staging.repository.repoPath, file: this.name() });
}
FileViewModel.prototype.ignoreFile = function() {
	this.app.post('/ignorefile', { path: this.staging.repository.repoPath, file: this.name() });
}
FileViewModel.prototype.resolveConflict = function() {
	this.app.post('/resolveconflicts', { path: this.staging.repository.repoPath, files: [this.name()] });
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
	if (this.type == 'image') {
		this.imageDiff.invalidateDiff(drawProgressBar);
	} else {
		this.fileDiff.invalidateDiff(drawProgressBar);
	}
}
FileViewModel.prototype.getDiffTypeObject = function() {
	if (this.type == 'image') {
		return this.imageDiff;
	} else {
		return this.fileDiff;
	}
}

var LineByLineDiffViewModel = function(ancestor) {
	this.ancestor = ancestor;
	this.templateName = 'textFileDiff';
}
LineByLineDiffViewModel.prototype.invalidateDiff = function(drawProgressBar) {
	var ancestor = this.ancestor;

	if (ancestor.showingDiffs()) {
		if (drawProgressBar) ancestor.diffsProgressBar.start();
		var isTextType = ancestor.type == 'text' ? true : false;
		ancestor.app.get('/diff', { file: ancestor.name(), path: ancestor.staging.repository.repoPath}, function(err, diffs) {
			if (diffs && diffs.length > 0 && diffs[0].type == 'image') {
				ancestor.type = 'image';
				ancestor.imageDiff.invalidateDiff(drawProgressBar);
				return;
			}
			if (drawProgressBar) ancestor.diffsProgressBar.stop();
			if (err) return;
			var newDiffs = [];
			diffs.forEach(function(diff) {
				diff.lines.forEach(
						function(line) {
							newDiffs.push({
								oldLineNumber: line[0],
								newLineNumber: line[1],
								added: line[2][0] == '+',
								removed: line[2][0] == '-' || line[2][0] == '\\',
								text: line[2]
							});
						}
					);
			});
			ancestor.diffs(newDiffs);
		});
	}
}

var ImageDiffViewModel = function(ancestor) {
	this.ancestor = ancestor;
	this.templateName = 'imageFileDiff';
}
ImageDiffViewModel.prototype.invalidateDiff = function(drawProgressBar) {
	var ancestor = this.ancestor;

	if (ancestor.showingDiffs()) {
		if (drawProgressBar) ancestor.diffsProgressBar.start();
		var isTextType = ancestor.type == 'text' ? true : false;
		var firstElement, secondElement, isFirstElementImage, isSecondElementImage;
		var newDiffs = [];

		if (drawProgressBar) ancestor.diffsProgressBar.stop();
		
		if(ancestor.isNew()) {
			firstElement = '#';
			isFirstElementImage = false;
			secondElement = getImageElement(ancestor.name(), ancestor.staging.repository.repoPath, 'current');
			isSecondElementImage = true;
		} else {
			firstElement = getImageElement(ancestor.name(), ancestor.staging.repository.repoPath, 'previous');
			isFirstElementImage = true;

			if(ancestor.removed()){
				secondElement = '#'
				isSecondElementImage = false;
			} else {
				secondElement = getImageElement(ancestor.name(), ancestor.staging.repository.repoPath, 'current');
				isSecondElementImage = true;
			}
		}
        newDiffs.push({
                firstElement: firstElement,
                isFirstElementImage: isFirstElementImage,
                secondElement: secondElement,
                isSecondElementImage: isSecondElementImage
        });

        ancestor.diffs(newDiffs);
	}
}

var getImageElement = function(imageFile, repoPath, version) {
	return '/api/diff/image?path=' + encodeURIComponent(repoPath) + '&filename=' + imageFile + '&version=' + version;
}
 