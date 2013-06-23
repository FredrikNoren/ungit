
var MainViewModel = function() {
	var self = this;
	this.path = ko.observable();
	this.dialog = ko.observable(null);
	this.isAuthenticated = ko.observable(!config.authentication);
	this.realContent = ko.observable(new HomeViewModel());
	if (config.authentication) {
		this.authenticationScreen = new LoginViewModel();
		this.authenticationScreen.loggedIn.add(function() {
			self.isAuthenticated(true);
		});
	}
	this.content = ko.computed({
		write: function(value) {
			self.realContent(value);
		},
		read: function() {
			if (self.isAuthenticated()) return self.realContent();
			else return self.authenticationScreen;
		}
	});
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

function AlertDialogViewModel(message) {
	this.message = message;
}
AlertDialogViewModel.prototype.template = 'alertDialog';
AlertDialogViewModel.prototype.close = function() {
	viewModel.dialog(null);
}

function PushDialogViewModel(args) {
	this.repoPath = args.repoPath;
	this.remoteBranch = args.remoteBranch;
	this.localBranch = args.localBranch;
	this.showCredentialsForm = ko.observable(false);
	this.username = ko.observable();
	this.password = ko.observable();
	setTimeout(this.startPush.bind(this), 1);
	this.done = new signals.Signal();
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
	var self = this;
	api.query('POST', '/push', { path: this.repoPath, socketId: api.socketId, remoteBranch: this.remoteBranch, localBranch: this.localBranch }, function(err, res) {
		if (err) {
			if (err.res.body.stderr.indexOf('ERROR: missing Change-Id in commit message footer') != -1) {
				viewModel.dialog(new AlertDialogViewModel('Missing Change-Id'));
				return true;
			}
		}
		viewModel.dialog(null);
		self.done.dispatch();
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

var LoginViewModel = function() {
	var self = this;
	this.loggedIn = new signals.Signal();
	this.status = ko.observable('loading');
	this.username = ko.observable();
	this.password = ko.observable();
	this.loginError = ko.observable();
	api.query('GET', '/loggedin', undefined, function(err, status) {
		if (status.loggedIn) {
			self.loggedIn.dispatch();
			self.status('loggedIn');
		}
		else self.status('login');
	});
}
LoginViewModel.prototype.login = function() {
	var self = this;
	api.query('POST', '/login',  { username: this.username(), password: this.password() }, function(err, res) {
		if (err) {
			if (err.res.body.error) {
				self.loginError(err.res.body.error);
				return true;
			}
		} else {
			self.loggedIn.dispatch();
			self.status('loggedIn');
		}
	});
}
LoginViewModel.prototype.template = 'login';

var UserErrorViewModel = function(args) {
	if (typeof(arguments[0]) == 'string')
		args = { title: arguments[0], details: arguments[1] };
	args = args || {};
	this.title = ko.observable(args.title);
	this.details = ko.observable(args.details);
}
UserErrorViewModel.prototype.template = 'usererror';

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
}
PathViewModel.prototype.template = 'path';
PathViewModel.prototype.shown = function() {
	this.updateStatus();
}
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

crossroads.addRoute('/', function() {
	viewModel.path('');
	viewModel.content(new HomeViewModel());
});

crossroads.addRoute('/repository{?query}', function(query) {
	viewModel.path(query.path);
	viewModel.content(new PathViewModel(query.path));
})


var viewModel = new MainViewModel();
