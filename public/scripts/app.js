
var options = {
	watcherSafeMode: false
};

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

var api = function(method, path, body, callback) {
	var q = superagent(method, '/api' + path);
	if (method == 'GET')
		q.query(body);
	else
		q.send(body);
	q.set('Accept', 'application/json')
		.end(function(error, res){
			if (error || !res.ok)
				viewModel.content(new CrashViewModel());
			else if(callback)
				callback(res);
		});
}

var FileViewModel = function(args) {
	this.staged = ko.observable(args.staged);
	this.name = args.name;
	this.repository = args.repository;
	this.isNew = ko.observable(args.isNew);
}
FileViewModel.prototype.toogleStaged = function() {
	var self = this;
	var isStaged = this.staged();
	var method;
	if (!isStaged) method = '/stage';
	else method = '/unstage';
	api('POST', method, { path: this.repository.path, file: this.name });
}
FileViewModel.prototype.discardChanges = function() {
	api('POST', '/discardchanges', { path: this.repository.path, file: this.name });
}

function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

var gitConfig = ko.observable({});
api('GET', '/config', undefined, function(res){
	gitConfig(res.body.config);
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
	var socket = io.connect('http://localhost:3000');
	socket.emit('watch', { path: path, safeMode: options.watcherSafeMode });
	socket.on('ready', function (data) {
		self.watcherReady(true);
	});
	socket.on('changed', function (data) {
		self.updateStatus();
		self.updateLog();
	});
}
RepositoryViewModel.prototype.template = 'repository';
RepositoryViewModel.prototype.updateStatus = function(opt_callback) {
	var self = this;
	api('GET', '/status', { path: this.path }, function(res){
		if (res.body.inited) {
			self.status('inited');
			self.files.removeAll();
			res.body.files.sort(function(a, b) {
				return a.name > b.name ? 1 : -1;
			}).forEach(function(args) {
				args.repository = self;
				self.files.push(new FileViewModel(args));
			});
			if (opt_callback) opt_callback();
		} else {
			self.status('uninited');
		}
	});
}
RepositoryViewModel.prototype.updateLog = function() {
	var self = this;
	api('GET', '/log', { path: this.path }, function(res){
		self.logEntries.removeAll();
		res.body.entries.forEach(function(entry) {
			var date = entry.date;
			entry.date = ko.observable(moment(date).fromNow());
			setInterval(function() { entry.date(moment(date).fromNow()); }, 1000 * 60);
			self.logEntries.push(entry);
		});
	});
}
RepositoryViewModel.prototype.initRepository = function() {
	var self = this;
	api('POST', '/init', { path: this.path });
}
RepositoryViewModel.prototype.commit = function() {
	var self = this;
	api('POST', '/commit', { path: this.path, message: this.commitMessage() }, function(res){
		self.commitMessage('');
	});
}

crossroads.addRoute('/', function() {
	browseTo('repository?path=' + encodeURIComponent('D:/Code/pep-git/tmp')); // temporary redirect for quick testing
});

crossroads.addRoute('/repository{?query}', function(query) {
	viewModel.content(new RepositoryViewModel(query.path));
})
