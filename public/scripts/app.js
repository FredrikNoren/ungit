
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


var FileViewModel = function(args) {
	var self = this;
	this.staged = ko.observable(args.staged);
	this.name = args.name;
	this.repository = args.repository;
	this.isNew = ko.observable(args.isNew);
	this.diffs = ko.observableArray();
	this.showDiffs = ko.observable(false);
}
FileViewModel.prototype.toogleStaged = function() {
	var self = this;
	var isStaged = this.staged();
	var method;
	if (!isStaged) method = '/stage';
	else method = '/unstage';
	api.query('POST', method, { path: this.repository.path, file: this.name });
}
FileViewModel.prototype.discardChanges = function() {
	api.query('POST', '/discardchanges', { path: this.repository.path, file: this.name });
}
FileViewModel.prototype.toogleDiffs = function() {
	var self = this;
	if (this.showDiffs()) this.showDiffs(false);
	else {
		this.showDiffs(true);
		api.query('GET', '/diff', { file: this.name, path: this.repository.path }, function(err, diffs) {
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
	this.logEntries = ko.observableArray();
	this.updateStatus();
	this.updateLog();
	this.watcherReady = ko.observable(false);
	api.watchRepository(path, {
		ready: function() { self.watcherReady(true) },
		changed: function() { self.updateStatus(); self.updateLog(); }
	});
}
RepositoryViewModel.prototype.template = 'repository';
RepositoryViewModel.prototype.updateStatus = function(opt_callback) {
	var self = this;
	api.query('GET', '/status', { path: this.path }, function(err, status){
		if (!err) {
			self.status('inited');
			self.files.removeAll();
			status.files.sort(function(a, b) {
				return a.name > b.name ? 1 : -1;
			}).forEach(function(args) {
				args.repository = self;
				self.files.push(new FileViewModel(args));
			});
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
		self.logEntries.removeAll();
		logEntries.forEach(function(entry) {
			var date = entry.date;
			entry.date = ko.observable(moment(date).fromNow());
			setInterval(function() { entry.date(moment(date).fromNow()); }, 1000 * 60);
			self.logEntries.push(entry);
		});
	});
}
RepositoryViewModel.prototype.initRepository = function() {
	var self = this;
	api.query('POST', '/init', { path: this.path });
}
RepositoryViewModel.prototype.commit = function() {
	var self = this;
	api.query('POST', '/commit', { path: this.path, message: this.commitMessage() }, function(err, res) {
		self.commitMessage('');
	});
}

crossroads.addRoute('/', function() {
	browseTo('repository?path=' + encodeURIComponent('D:/Code/pep-git/tmp')); // temporary redirect for quick testing
});

crossroads.addRoute('/repository{?query}', function(query) {
	viewModel.content(new RepositoryViewModel(query.path));
})
