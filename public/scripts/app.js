
var MainViewModel = function() {
	var self = this;
	this.path = ko.observable();
	this.dialog = ko.observable(null);
	this.content = ko.observable(new HomeViewModel());
}
MainViewModel.prototype.submitPath = function() {
	browseTo('repository?path=' + encodeURIComponent(this.path()));
}
MainViewModel.prototype.templateChooser = function(data) {
	if (!data) return '';
	return data.template;
};

var visitedRepositories = {
	getAll: function() {
		return JSON.parse(localStorage.getItem('visitedRepositories') || '[]');
	},
	tryAdd: function(path) {
		var repos = this.getAll();
		var i;
		while((i = repos.indexOf(path)) != -1)
			repos.splice(i, 1);

		repos.unshift(path);
		localStorage.setItem('visitedRepositories', JSON.stringify(repos));
	}
}

var viewModel = new MainViewModel();

function PushDialogViewModel(repoPath) {
	this.repoPath = repoPath;
	this.showCredentialsForm = ko.observable(false);
	this.username = ko.observable();
	this.password = ko.observable();
	setTimeout(this.startPush.bind(this), 1);
}
PushDialogViewModel.prototype.template = 'pushDialog';
PushDialogViewModel.prototype.askForCredentials = function(callback) {
	this.credentialsCallback = callback;
	this.showCredentialsForm(true);
}
PushDialogViewModel.prototype.submitCredentials = function() {
	this.credentialsCallback({ username: this.username(), password: this.password() });
	this.showCredentialsForm(false);
}
PushDialogViewModel.prototype.startPush = function() {
	api.query('POST', '/push', { path: this.repoPath, socketId: api.socketId }, function(err, res) {
		viewModel.dialog(null);
	});
}

function HomeViewModel() {
	this.repos = visitedRepositories.getAll().map(function(path) {
		return {
			title: path,
			link: '/#/repository?path=' + encodeURIComponent(path)
		};
	});
}
HomeViewModel.prototype.template = 'home';

var CrashViewModel = function() {
}
CrashViewModel.prototype.template = 'crash';


var idCounter = 0;
var newId = function() { return idCounter++; };

function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

var gitConfig = ko.observable({});
api.query('GET', '/config', undefined, function(err, config) {
	if (err) return;
	gitConfig(config);
});

var PathViewModel = function(path) {
	var self = this;
	this.path = path;
	this.status = ko.observable('loading');
	this.cloneUrl = ko.observable();
	this.cloneDestinationImplicit = ko.computed(function() {
		var defaultText = 'destination folder';
		if (!self.cloneUrl()) return defaultText;
		var ss = self.cloneUrl().split('/');
		if (ss.length == 0) return defaultText;
		var s = _.last(ss);
		if (s.indexOf('.git') == s.length - 4) s = s.slice(0, -4);
		if (!s) return defaultText;
		return s;
	});
	this.cloneDestination = ko.observable();
	this.repository = ko.observable();

	var p2 = path.replace(/\\/g, '/');
	var pathSplit = p2.split('/');
	this.titleSubPath = pathSplit.slice(0, pathSplit.length - 1).join('/') + '/';
	this.title = capitaliseFirstLetter(pathSplit[pathSplit.length - 1]);
	this.updateStatus();
}
PathViewModel.prototype.template = 'path';
PathViewModel.prototype.updateStatus = function() {
	var self = this;
	api.query('GET', '/status', { path: this.path }, function(err, status){
		if (!err) {
			self.status('repository');
			self.repository(new RepositoryViewModel(self.path));
		} else if (err.errorCode == 'not-a-repository') {
			self.status('uninited');
			return true;
		} else if (err.errorCode == 'no-such-path') {
			self.status('invalidpath');
			return true;
		}
	});
}
PathViewModel.prototype.initRepository = function() {
	var self = this;
	api.query('POST', '/init', { path: this.path }, function(err, res) {
		if (err) return;
		self.updateStatus();
	});
}
PathViewModel.prototype.cloneRepository = function() {
	var self = this;
	self.status('cloning');
	var dest = this.cloneDestination() || this.cloneDestinationImplicit();
	api.query('POST', '/clone', { path: this.path, url: this.cloneUrl(), destinationDir: dest }, function(err, res) {
		if (err) return;
		browseTo('repository?path=' + encodeURIComponent(self.path + '/' + dest));
	});
}

var RepositoryViewModel = function(path) {
	var self = this;
	this.status = ko.observable('loading');

	visitedRepositories.tryAdd(path);
	
	this.files = ko.observableArray();
	this.commitMessage = ko.observable();
	this.commitAuthorName = ko.computed(function() {
		return gitConfig()['user.name'];
	});
	this.commitAuthorEmail = ko.computed(function() {
		return gitConfig()['user.email'];
	});
	this.isCommitting = ko.observable(false);
	this.selectedDiffFile = ko.observable();
	this.path = path;
	this.commitValidationError = ko.computed(function() {
		if (!self.files().some(function(file) { return file.staged(); }))
			return "No files to commit";
		if (!self.commitMessage()) return "Provide a commit message";
		return "";
	});
	this.isFetching = ko.observable(false);
	this.graph = new GitGraphViewModel(path);
	this.updateStatus();
	this.watcherReady = ko.observable(false);
	this.status.subscribe(function(newValue) {
		if (newValue == 'inited') {
			self.update();
			self.fetch();
			api.watchRepository(path, {
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
	this.files().forEach(function(file) {
		file.invalidateDiff();
	});
}
RepositoryViewModel.prototype.fetch = function() {
	if (this.status() != 'inited') return;
	var self = this;
	this.isFetching(true);
	api.query('POST', '/fetch', { path: this.path }, function(err, status) {
		self.isFetching(false);
	});
}
RepositoryViewModel.prototype.updateStatus = function(opt_callback) {
	var self = this;
	api.query('GET', '/status', { path: this.path }, function(err, status){
		if (err) return;
		self.status('inited');
		var updateId = newId();
		for(var file in status.files) {
			var fileViewModel = _.find(self.files(), function(fileVM) { return fileVM.name() == file });
			if (!fileViewModel) {
				fileViewModel = new FileViewModel(self);
				fileViewModel.name(file);
				self.files.push(fileViewModel);
			}
			fileViewModel.isNew(status.files[file].isNew);
			fileViewModel.removed(status.files[file].removed);
			fileViewModel.lastUpdateId = updateId;
		}
		for (var i = self.files().length - 1; i >= 0; i--) {
			if (self.files()[i].lastUpdateId != updateId)
				self.files.splice(i, 1);
		}
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
	api.query('GET', '/branch', { path: this.path }, function(err, branch) {
		if (err && err.errorCode == 'not-a-repository') return true;
		if (err) return;
		self.graph.activeBranch(branch);
	});
}
RepositoryViewModel.prototype.updateRemotes = function() {
	if (this.status() != 'inited') return;
	var self = this;
	api.query('GET', '/remotes', { path: this.path }, function(err, remotes) {
		if (err && err.errorCode == 'not-a-repository') return true;
		if (err) return;
		self.graph.hasRemotes(remotes.length != 0);
	});
}
RepositoryViewModel.prototype.toogleShowBranches = function() {
	this.showBranches(!this.showBranches());
}
RepositoryViewModel.prototype.createNewBranch = function() {
	api.query('POST', '/branches', { path: this.path, name: this.newBranchName() });
	this.newBranchName('');
}
RepositoryViewModel.prototype.commit = function() {
	var self = this;
	this.isCommitting(true);
	var files = this.files().filter(function(file) {
		return file.staged();
	}).map(function(file) {
		return file.name();
	});
	api.query('POST', '/commit', { path: this.path, message: this.commitMessage(), files: files }, function(err, res) {
		self.commitMessage('');
		self.files.removeAll();
		self.selectedDiffFile(null);
		self.isCommitting(false);
	});
}

var FileViewModel = function(repository) {
	var self = this;
	this.repository = repository;

	this.staged = ko.observable(true);
	this.name = ko.observable();
	this.isNew = ko.observable(false);
	this.removed = ko.observable(false);
	this.diffs = ko.observableArray();
	this.showingDiffs = ko.computed(function() {
		return self.repository.selectedDiffFile() == self;
	})
}
FileViewModel.prototype.toogleStaged = function() {
	this.staged(!this.staged());
}
FileViewModel.prototype.discardChanges = function() {
	this.repository.selectedDiffFile(null);
	api.query('POST', '/discardchanges', { path: this.repository.path, file: this.name() });
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
		api.query('GET', '/diff', { file: this.name(), path: this.repository.path }, function(err, diffs) {
			if (err) return;
			self.diffs.removeAll();
			diffs.forEach(function(diff) {
				diff.lines.forEach(function(line) {
					self.diffs.push({
						oldLineNumber: line[0],
						newLineNumber: line[1],
						added: line[2][0] == '+',
						removed: line[2][0] == '-' || line[2][0] == '\\',
						text: line[2]
					});
				});
			});
		});
	}
}


crossroads.addRoute('/', function() {
	viewModel.path('');
	viewModel.content(new HomeViewModel());
});

crossroads.addRoute('/repository{?query}', function(query) {
	viewModel.path(query.path);
	viewModel.content(new PathViewModel(query.path));
})
