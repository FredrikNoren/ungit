
var MainViewModel = function() {
	this.content = ko.observable(new EmptyViewModel());
}
MainViewModel.prototype.templateChooser = function(data) {
	return data.template;
};

var viewModel = new MainViewModel();

function EmptyViewModel() {
}
EmptyViewModel.prototype.template = 'empty';

var CrashViewModel = function() {
}
CrashViewModel.prototype.template = 'crash';

var idCounter = 0;
var newId = function() { return idCounter++; };

var FileViewModel = function(repository) {
	var self = this;
	this.repository = repository;

	this.staged = ko.observable(true);
	this.name = ko.observable();
	this.isNew = ko.observable(false);
	this.diffs = ko.observableArray();
	this.showDiffs = ko.observable(false);
}
FileViewModel.prototype.toogleStaged = function() {
	this.staged(!this.staged());
}
FileViewModel.prototype.discardChanges = function() {
	api.query('POST', '/discardchanges', { path: this.repository.path, file: this.name() });
}
FileViewModel.prototype.toogleDiffs = function() {
	var self = this;
	if (this.showDiffs()) this.showDiffs(false);
	else {
		this.showDiffs(true);
		this.invalidateDiff();
	}
}
FileViewModel.prototype.invalidateDiff = function() {
	var self = this;
	if (this.showDiffs()) {
		api.query('GET', '/diff', { file: this.name(), path: this.repository.path }, function(err, diffs) {
			if (err) return;
			self.diffs.removeAll();
			diffs.forEach(function(diff) {
				diff.lines.forEach(function(line) {
					self.diffs.push({
						added: line[0] == '+',
						removed: line[0] == '-' || line[0] == '\\',
						text: line.slice(1)
					});
				});
			});
		});
	}
}

function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

var gitConfig = ko.observable({});
api.query('GET', '/config', undefined, function(err, config) {
	if (err) return;
	gitConfig(config);
});

var RepositoryViewModel = function(path) {
	var self = this;
	this.status = ko.observable('loading');
	this.files = ko.observableArray();
	this.commitMessage = ko.observable();
	this.commitAuthorName = ko.computed(function() {
		return gitConfig()['user.name'];
	});
	this.commitAuthorEmail = ko.computed(function() {
		return gitConfig()['user.email'];
	});
	this.path = path;
	var pathSplit = path.split('/');
	this.title = capitaliseFirstLetter(pathSplit[pathSplit.length - 1]);
	this.commitValidationError = ko.computed(function() {
		if (!self.files().some(function(file) { return file.staged(); }))
			return "No files to commit";
		if (!self.commitMessage()) return "Provide a commit message";
		return "";
	});
	this.logEntries = ko.observable([]);
	this.branches = ko.observableArray();
	this.branch = ko.observable();
	this.showBranches = ko.observable(false);
	this.newBranchName = ko.observable();
	this.update();
	this.watcherReady = ko.observable(false);
	api.watchRepository(path, {
		ready: function() { self.watcherReady(true) },
		changed: function() { self.update(); }
	});
}
RepositoryViewModel.prototype.template = 'repository';
RepositoryViewModel.prototype.update = function() {
	this.updateStatus();
	this.updateLog();
	this.updateBranches();
	this.files().forEach(function(file) {
		file.invalidateDiff();
	});
}
RepositoryViewModel.prototype.updateStatus = function(opt_callback) {
	var self = this;
	api.query('GET', '/status', { path: this.path }, function(err, status){
		if (!err) {
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
				fileViewModel.lastUpdateId = updateId;
			}
			for (var i = self.files().length - 1; i >= 0; i--) {
				if (self.files()[i].lastUpdateId != updateId)
					self.files.splice(i, 1);
			}
			if (opt_callback) opt_callback();
		} else if (err.errorCode == 'not-a-repository') {
			self.status('uninited');
			return true;
		}
	});
}
RepositoryViewModel.prototype.updateLog = function() {
	var self = this;
	api.query('GET', '/log', { path: this.path }, function(err, logEntries) {
		if (err) return;
		logEntries.forEach(function(entry) {
			var date = entry.date;
			entry.date = ko.observable(moment(date).fromNow());
			setInterval(function() { entry.date(moment(date).fromNow()); }, 1000 * 60);
		});
		self.logEntries(logEntries);
	});
}
RepositoryViewModel.prototype.updateBranches = function() {
	var self = this;
	api.query('GET', '/branches', { path: this.path }, function(err, branches) {
		if (err) return;
		self.branches.removeAll();
		branches.forEach(function(branch) {
			branch.current = !!branch.current;
			branch.switchTo = function() { api.query('POST', '/branch', { path: self.path, name: branch.name }) };
			self.branches.push(branch);
			if (branch.current) self.branch(branch.name);
		});
	});
}
RepositoryViewModel.prototype.toogleShowBranches = function() {
	this.showBranches(!this.showBranches());
}
RepositoryViewModel.prototype.createNewBranch = function() {
	api.query('POST', '/branches', { path: this.path, name: this.newBranchName() });
	this.newBranchName('');
}
RepositoryViewModel.prototype.initRepository = function() {
	var self = this;
	api.query('POST', '/init', { path: this.path });
}
RepositoryViewModel.prototype.commit = function() {
	var self = this;
	var files = this.files().filter(function(file) {
		return file.staged();
	}).map(function(file) {
		return file.name();
	});
	api.query('POST', '/commit', { path: this.path, message: this.commitMessage(), files: files }, function(err, res) {
		self.commitMessage('');
	});
}

crossroads.addRoute('/', function() {
	browseTo('repository?path=' + encodeURIComponent('D:/Code/pep-git/tmp')); // temporary redirect for quick testing
});

crossroads.addRoute('/repository{?query}', function(query) {
	viewModel.content(new RepositoryViewModel(query.path));
})
