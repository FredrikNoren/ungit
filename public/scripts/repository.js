
var idCounter = 0;
var newId = function() { return idCounter++; };


var RepositoryViewModel = function(main, repoPath) {
	var self = this;
	this.status = ko.observable('loading');

	visitedRepositories.tryAdd(repoPath);
	this.main = main;
	this.repoPath = repoPath;
	this.staging = new StagingViewModel(this);
	this.gerritIntegration = ko.observable(null);
	this.isFetching = ko.observable(false);
	this.graph = new GitGraphViewModel(this);
	this.updateStatus();
	this.watcherReady = ko.observable(false);
	this.status.subscribe(function(newValue) {
		if (newValue == 'inited') {
			self.update();
			self.fetch();
			api.watchRepository(repoPath, {
				disconnect: function() {
					self.main.content(new UserErrorViewModel('Connection lost', 'Refresh the page to try to reconnect'));
				},
				ready: function() { self.watcherReady(true) },
				changed: function() { self.update(); },
				requestCredentials: function(callback) {
					self.main.dialog().askForCredentials(callback);
				}
			});
			if (ungit.config.gerrit) {
				self.gerritIntegration(new GerritIntegrationViewModel(self));
			}
		}
	});
}
RepositoryViewModel.prototype.update = function() {
	this.updateStatus();
	this.updateLog();
	this.updateBranches();
	this.updateRemotes();
	this.staging.invalidateFilesDiffs();
}
RepositoryViewModel.prototype.fetch = function() {
	if (this.status() != 'inited') return;
	var self = this;
	this.isFetching(true);
	api.query('POST', '/fetch', { path: this.repoPath }, function(err, status) {
		if (err) {
			if (err.errorCode == 'no-supported-authentication-provided') {
				self.main.content(new UserErrorViewModel({
					title: 'Authentication error',
					details: 'No supported authentication methods available. Try starting ssh-agent or pageant.'
				}));
				return true;
			}
		}
		self.isFetching(false);
	});
}
RepositoryViewModel.prototype.updateStatus = function(opt_callback) {
	var self = this;
	api.query('GET', '/status', { path: this.repoPath }, function(err, status){
		if (err) return;
		self.status('inited');
		self.staging.setFiles(status.files);
		if (opt_callback) opt_callback();
	});
}
RepositoryViewModel.prototype.updateLog = function() {
	if (this.status() != 'inited') return;
	this.graph.loadNodesFromApi();
}
RepositoryViewModel.prototype.updateBranches = function() {
	if (this.status() != 'inited') return;
	var self = this;
	api.query('GET', '/checkout', { path: this.repoPath }, function(err, branch) {
		if (err && err.errorCode == 'not-a-repository') return true;
		if (err) return;
		self.graph.activeBranch(branch);
	});
}
RepositoryViewModel.prototype.updateRemotes = function() {
	if (this.status() != 'inited') return;
	var self = this;
	api.query('GET', '/remotes', { path: this.repoPath }, function(err, remotes) {
		if (err && err.errorCode == 'not-a-repository') return true;
		if (err) return;
		self.graph.hasRemotes(remotes.length != 0);
	});
}
RepositoryViewModel.prototype.toogleShowBranches = function() {
	this.showBranches(!this.showBranches());
}
RepositoryViewModel.prototype.createNewBranch = function() {
	api.query('POST', '/branches', { path: this.repoPath, name: this.newBranchName() });
	this.newBranchName('');
}



var StagingViewModel = function(repository) {
	var self = this;
	this.repository = repository;
	this.repoPath = this.repository.repoPath;
	this.files = ko.observableArray();
	this.commitMessageTitle = ko.observable();
	this.commitMessageBody = ko.observable();
	this.nFiles = ko.computed(function() {
		return self.files().length;
	});
	this.nStagedFiles = ko.computed(function() {
		return self.files().filter(function(f) { return f.staged(); }).length;
	});
	this.stats = ko.computed(function() {
		return self.nFiles() + ' files, ' + self.nStagedFiles() + ' to be commited';
	})
	this.amend = ko.observable(false);
	this.isCommitting = ko.observable(false);
	this.selectedDiffFile = ko.observable();
	this.commitValidationError = ko.computed(function() {
		if (!self.amend() && !self.files().some(function(file) { return file.staged(); }))
			return "No files to commit";
		if (!self.commitMessageTitle()) return "Provide a title";
		return "";
	});
}
StagingViewModel.prototype.setFiles = function(files) {
	var self = this;
	var updateId = newId();
	for(var file in files) {
		var fileViewModel = _.find(self.files(), function(fileVM) { return fileVM.name() == file });
		if (!fileViewModel) {
			fileViewModel = new FileViewModel(self);
			fileViewModel.name(file);
			self.files.push(fileViewModel);
		}
		fileViewModel.isNew(files[file].isNew);
		fileViewModel.removed(files[file].removed);
		fileViewModel.lastUpdateId = updateId;
	}
	for (var i = self.files().length - 1; i >= 0; i--) {
		if (self.files()[i].lastUpdateId != updateId)
			self.files.splice(i, 1);
	}
}
StagingViewModel.prototype.toogleAmend = function() {
	if (!this.amend() && !this.commitMessageTitle()) {
		this.commitMessageTitle(this.repository.graph.HEAD().title);
		this.commitMessageBody(this.repository.graph.HEAD().body);
	}
	else if(this.amend()) {
		this.commitMessageTitle('');
		this.commitMessageBody('');
	}
	this.amend(!this.amend());
}
StagingViewModel.prototype.commit = function() {
	var self = this;
	this.isCommitting(true);
	var files = this.files().filter(function(file) {
		return file.staged();
	}).map(function(file) {
		return file.name();
	});
	var commitMessage = this.commitMessageTitle();
	if (this.commitMessageBody()) commitMessage += '\n\n' + this.commitMessageBody();
	api.query('POST', '/commit', { path: this.repository.repoPath, message: commitMessage, files: files, amend: this.amend() }, function(err, res) {
		self.commitMessageTitle('');
		self.commitMessageBody('');
		self.amend(false);
		self.files.removeAll();
		self.selectedDiffFile(null);
		self.isCommitting(false);
	});
}
StagingViewModel.prototype.invalidateFilesDiffs = function() {
	this.files().forEach(function(file) {
		file.invalidateDiff();
	});
}
StagingViewModel.prototype.discardAllChanges = function() {
	this.selectedDiffFile(null);
	api.query('POST', '/discardchanges', { path: this.repository.repoPath, all: true });
}


var FileViewModel = function(staging) {
	var self = this;
	this.staging = staging;

	this.staged = ko.observable(true);
	this.name = ko.observable();
	this.isNew = ko.observable(false);
	this.removed = ko.observable(false);
	this.diffs = ko.observable([]);
	this.showingDiffs = ko.computed(function() {
		return self.staging.selectedDiffFile() == self;
	})
}
FileViewModel.prototype.toogleStaged = function() {
	this.staged(!this.staged());
}
FileViewModel.prototype.discardChanges = function() {
	this.staging.selectedDiffFile(null);
	api.query('POST', '/discardchanges', { path: this.staging.repository.repoPath, file: this.name() });
}
FileViewModel.prototype.toogleDiffs = function() {
	var self = this;
	if (this.staging.selectedDiffFile() == this) this.staging.selectedDiffFile(null);
	else {
		this.staging.selectedDiffFile(this);
		this.invalidateDiff();
	}
}
FileViewModel.prototype.invalidateDiff = function() {
	var self = this;
	if (this.staging.selectedDiffFile() == this) {
		api.query('GET', '/diff', { file: this.name(), path: this.staging.repository.repoPath }, function(err, diffs) {
			if (err) return;
			var newDiffs = [];
			diffs.forEach(function(diff) {
				diff.lines.forEach(function(line) {
					newDiffs.push({
						oldLineNumber: line[0],
						newLineNumber: line[1],
						added: line[2][0] == '+',
						removed: line[2][0] == '-' || line[2][0] == '\\',
						text: line[2]
					});
				});
			});
			self.diffs(newDiffs);
		});
	}
}


