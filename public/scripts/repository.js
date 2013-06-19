
var idCounter = 0;
var newId = function() { return idCounter++; };


var RepositoryViewModel = function(repoPath) {
	var self = this;
	this.status = ko.observable('loading');

	visitedRepositories.tryAdd(repoPath);
	
	this.repoPath = repoPath;
	this.staging = new StagingViewModel(this);
	this.gerritIntegration = ko.observable(null);
	this.showGerritIntegrationButton = ko.computed(function() {
		return config.gerritIntegration && !self.gerritIntegration();
	});
	this.isFetching = ko.observable(false);
	this.graph = new GitGraphViewModel(repoPath);
	this.updateStatus();
	this.watcherReady = ko.observable(false);
	this.status.subscribe(function(newValue) {
		if (newValue == 'inited') {
			self.update();
			self.fetch();
			api.watchRepository(repoPath, {
				disconnect: function() {
					viewModel.content(new UserErrorViewModel('Connection lost', 'Refresh the page to try to reconnect'));
				},
				ready: function() { self.watcherReady(true) },
				changed: function() { self.update(); },
				requestCredentials: function(callback) {
					viewModel.dialog().askForCredentials(callback);
				}
			});
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
				viewModel.content(new UserErrorViewModel({
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
RepositoryViewModel.prototype.toogleGerritIntegration = function() {
	if (this.gerritIntegration())
		this.gerritIntegration(null);
	else
		this.gerritIntegration(new GerritIntegrationViewModel(this));
}



var StagingViewModel = function(repository) {
	var self = this;
	this.repository = repository;
	this.repoPath = this.repository.repoPath;
	this.files = ko.observableArray();
	this.commitMessageTitle = ko.observable();
	this.commitMessageBody = ko.observable();
	this.commitAuthorName = ko.computed(function() {
		return gitConfig()['user.name'];
	});
	this.commitAuthorEmail = ko.computed(function() {
		return gitConfig()['user.email'];
	});
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
		this.commitMessageTitle(this.graph.HEAD().title);
		this.commitMessageBody(this.graph.HEAD().body);
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

var FileViewModel = function(repository) {
	var self = this;
	this.repository = repository;

	this.staged = ko.observable(true);
	this.name = ko.observable();
	this.isNew = ko.observable(false);
	this.removed = ko.observable(false);
	this.diffs = ko.observable([]);
	this.showingDiffs = ko.computed(function() {
		return self.repository.selectedDiffFile() == self;
	})
}
FileViewModel.prototype.toogleStaged = function() {
	this.staged(!this.staged());
}
FileViewModel.prototype.discardChanges = function() {
	this.repository.selectedDiffFile(null);
	api.query('POST', '/discardchanges', { path: this.repository.repoPath, file: this.name() });
}
FileViewModel.prototype.toogleDiffs = function() {
	var self = this;
	if (this.repository.selectedDiffFile() == this) this.repository.selectedDiffFile(null);
	else {
		this.repository.selectedDiffFile(this);
		this.invalidateDiff();
	}
}
FileViewModel.prototype.invalidateDiff = function() {
	var self = this;
	if (this.repository.selectedDiffFile() == this) {
		api.query('GET', '/diff', { file: this.name(), path: this.repository.repoPath }, function(err, diffs) {
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



var GerritIntegrationViewModel = function(repo) {
	var self = this;
	this.repo = repo;
	this.showInitCommmitHook = ko.observable(false);
	this.initCommitHookMessage = ko.observable('Init commit hook');
	this.loadingChanges = ko.observable(true);
	this.changes = ko.observable();
	this.updateCommitHook();
	this.updateChanges();
}
GerritIntegrationViewModel.prototype.updateCommitHook = function() {
	var self = this;
	api.query('GET', '/gerrit/commithook', { path: this.repo.repoPath }, function(err, hook) {
		self.showInitCommmitHook(!hook.exists);
	});
}
GerritIntegrationViewModel.prototype.updateChanges = function() {
	var self = this;
	self.loadingChanges(true);
	api.query('GET', '/gerrit/changes', { path: this.repo.repoPath }, function(err, changes) {
		if (err || !changes) return true;
		self.changes(changes.slice(0, changes.length - 1).map(function(c) { return new GerritChangeViewModel(self, c); }));
		self.loadingChanges(false);
	});
}
GerritIntegrationViewModel.prototype.initCommitHook = function() {
	var self = this;
	this.initCommitHookMessage('Initing commit hook...');
	api.query('POST', '/gerrit/commithook', { path: this.repo.repoPath }, function(err) {
		self.updateCommitHook();
	});
}
GerritIntegrationViewModel.prototype.getChange = function(changeId) {
	return _.find(this.changes(), function(change) { return change.data.id == changeId; });
}
GerritIntegrationViewModel.prototype.getChangeIdFromMessage = function(message) {
	var changeId = _.last(message.split('\n')).trim();
	if (changeId && changeId.indexOf('Change-Id: ') == 0) {
		return changeId.slice('Change-Id: '.length).trim();
	}
}
GerritIntegrationViewModel.prototype.getChangeFromNode = function(node) {
	var changeId = this.getChangeIdFromMessage(node.message);
	if (!changeId) return;
	return this.getChange(changeId);
}
GerritIntegrationViewModel.prototype.pushForReview = function() {
	var self = this;
	var branch = this.repo.graph.activeBranch();
	var change = this.getChangeFromNode(this.repo.graph.HEAD());
	if (change) branch = change.data.branch;
	var dialog = new PushDialogViewModel({ repoPath: this.repo.repoPath, remoteBranch: 'refs/for/' + branch });
	dialog.done.add(function() {
		self.updateChanges();
	});
	viewModel.dialog(dialog);
}

var GerritChangeViewModel = function(gerritIntegration, args) {
	this.gerritIntegration = gerritIntegration;
	this.subject = args.subject;
	this.ownerName = args.owner.name;
	this.sha1 = args.sha1;
	this.data = args;
};
GerritChangeViewModel.prototype.checkout = function() {
	var self = this;
	api.query('POST', '/fetch', { path: this.gerritIntegration.repo.repoPath, ref: this.data.currentPatchSet.ref }, function(err) {
		api.query('POST', '/checkout', { path: self.gerritIntegration.repo.repoPath, name: 'FETCH_HEAD' });
	});
}
GerritChangeViewModel.prototype.openInGerrit = function() {
	var win = window.open(this.data.url, '_blank');
  win.focus();
}
