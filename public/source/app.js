
var crossroads = require('crossroads');
var signals = require('signals');
var ko = require('../vendor/js/knockout-2.2.1');
var ProgressBarViewModel = require('./controls').ProgressBarViewModel;
var dialogs = require('./dialogs');
var screens = require('./screens');
var blockable = require('../../source/utils/blockable');
var _ = require('underscore');
var superagent = require('../vendor/js/superagent');


var AppViewModel = function(crashHandler, browseTo) {
	var self = this;
	this.crashHandler = crashHandler;
	this.browseTo = browseTo;
	this.path = ko.observable();
	this.dialog = ko.observable(null);
	this.isAuthenticated = ko.observable(!ungit.config.authentication);
	this.connectionState = ko.observable('connecting');

	this.visitedRepositories = ko.computed({
		read: function() {
			return JSON.parse(localStorage.getItem('visitedRepositories') || '[]');
		},
		write: function(value) {
			localStorage.setItem('visitedRepositories', JSON.stringify(value));
		}
	});

	this.realContent = ko.observable(new screens.HomeViewModel(this));
	this.currentVersion = ko.observable();
	this.latestVersion = ko.observable();
	this.newVersionAvailable = ko.observable();
	this.showBugtrackingNagscreen = ko.observable(false);
	// The ungit.config variable collections configuration from all different paths and only updates when
	// ungit is restarted
	if(!ungit.config.bugtracking && !localStorage.getItem('bugtrackingNagscreenDismissed')) {
		// Whereas the userconfig only reflects what's in the ~/.ungitrc and updates directly,
		// but is only used for changing around the configuration. We need to check this here
		// since ungit may have crashed without the server crashing since we enabled bugtracking,
		// and we don't want to show the nagscreen twice in that case.
		this.get('/userconfig', undefined, function(err, userConfig) {
			self.showBugtrackingNagscreen(!userConfig.bugtracking);
		});
	}
	this.programEvents = new signals.Signal();
	this.programEvents.add(function(event) {
		console.log('Event:', event);
	});
	this.get('/latestversion', undefined, function(err, version) {
		self.currentVersion(version.currentVersion);
		self.latestVersion(version.latestVersion);
		self.newVersionAvailable(version.outdated);
	});
	if (ungit.config.authentication) {
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
			if (self.connectionState() == 'disconnected') return new screens.UserErrorViewModel('Connection lost', 'Refresh the page to try to reconnect');
			if (self.connectionState() == 'connecting') return null;
			if (self.isAuthenticated()) return self.realContent();
			else return self.authenticationScreen;
		}
	});

	this.workingTreeChanged = blockable(_.throttle(function() {
		if (self.content() && self.content() instanceof screens.PathViewModel && self.content().repository())
			self.content().repository().onWorkingTreeChanged();
	}, 500));
	this.gitDirectoryChanged = blockable(_.throttle(function() {
		if (self.content() && self.content() instanceof screens.PathViewModel && self.content().repository())
			self.content().repository().onGitDirectoryChanged();
	}, 500));
	this._initSocket();
}
module.exports = AppViewModel;
AppViewModel.prototype.template = 'app';
AppViewModel.prototype._initSocket = function() {
	var self = this;
	this.socket = io.connect();
	this.socket.on('error', function(err) {
		self._isConnected(function(connected) {
			if (connected) throw err;
			else self._onDisconnect();
		});
	});
	this.socket.on('disconnect', function(data) {
		self._onDisconnect();
	});
	this.socket.on('connected', function (data) {
		self.socketId = data.socketId;
		self.connectionState('connected');
	});
	this.socket.on('working-tree-changed', function () {
		self.workingTreeChanged();
	});
	this.socket.on('git-directory-changed', function () {
		self.gitDirectoryChanged();
	});
	this.socket.on('request-credentials', function (data) {
		self._getCredentials(function(credentials) {
			self.socket.emit('credentials', credentials);
		});
	});
}
// Check if the server is still alive
AppViewModel.prototype._isConnected = function(callback) {
	superagent('GET', '/api/ping')
		.set('Accept', 'application/json')
		.end(function(error, res) {
			callback(!error && res && res.ok);
		});
}
AppViewModel.prototype._onDisconnect = function() {
	this.connectionState('disconnected');
}
AppViewModel.prototype._getCredentials = function(callback) {
	var self = this;
	var diag;
	// Only show one credentials dialog if we're asked to show another one while the first one is open
	// This happens for instance when we fetch nodes and remote tags at the same time
	if (self.dialog() instanceof dialogs.CredentialsDialogViewModel)
		diag = self.dialog();
	else {
		diag = new dialogs.CredentialsDialogViewModel();
		self.showDialog(diag);
	}
	self.programEvents.dispatch({ event: 'credentialsRequested' });
	diag.closed.add(function() {
		self.programEvents.dispatch({ event: 'credentialsProvided' });
		callback({ username: diag.username(), password: diag.password() });
	});
}
AppViewModel.prototype.watchRepository = function(repositoryPath, callback) {
	this.socket.emit('watch', { path: repositoryPath }, callback);
};

AppViewModel.prototype.updateAnimationFrame = function(deltaT) {
	if (this.content() && this.content().updateAnimationFrame) this.content().updateAnimationFrame(deltaT);
}
AppViewModel.prototype.submitPath = function() {
	this.browseTo('repository?path=' + encodeURIComponent(this.path()));
}
AppViewModel.prototype.showDialog = function(dialog) {
	var self = this;
	dialog.closed.add(function() {
		self.dialog(null);
	})
	this.dialog(dialog);
}
AppViewModel.prototype.enableBugtrackingAndStatistics = function() {
	var self = this;
	this.get('/userconfig', undefined, function(err, userConfig) {
		if (err) return;
		userConfig.bugtracking = true;
		userConfig.sendUsageStatistics = true;
		self.post('/userconfig', userConfig, function(err) {
			if (err) return;
			self.showBugtrackingNagscreen(false);
		});
	});
}
AppViewModel.prototype.enableBugtracking = function() {
	var self = this;
	this.get('/userconfig', undefined, function(err, userConfig) {
		if (err) return;
		userConfig.bugtracking = true;
		self.post('/userconfig', userConfig, function(err) {
			if (err) return;
			self.showBugtrackingNagscreen(false);
		});
	});
}
AppViewModel.prototype.dismissBugtrackingNagscreen = function() {
	this.showBugtrackingNagscreen(false);
	localStorage.setItem('bugtrackingNagscreenDismissed', true);
}
AppViewModel.prototype.templateChooser = function(data) {
	if (!data) return '';
	return data.template;
};
AppViewModel.prototype.addVisitedRepository = function(repoPath) {
	var repos = this.visitedRepositories();
	var i;
	while((i = repos.indexOf(repoPath)) != -1)
		repos.splice(i, 1);

	repos.unshift(repoPath);
	this.visitedRepositories(repos);
}
AppViewModel.prototype.get = function(path, query, callback) {
	this.query('GET', path, query, callback);
}
AppViewModel.prototype.post = function(path, body, callback) {
	this.query('POST', path, body, callback);
}
AppViewModel.prototype.del = function(path, query, callback) {
	this.query('DELETE', path, query, callback);
}
AppViewModel.prototype.query = function(method, path, body, callback) {
	var self = this;
	if (body) body.socketId = this.socketId;
	var q = superagent(method, '/api' + path);
	if (method == 'GET' || method == 'DELETE') q.query(body);
	else q.send(body);
	if (method != 'GET') {
		self.workingTreeChanged.block();
		self.gitDirectoryChanged.block();
	}
	q.set('Accept', 'application/json');
	q.end(function(error, res) {
		if (method != 'GET') {
			self.workingTreeChanged.unblock();
			self.gitDirectoryChanged.unblock();
		}
		if (error || !res.ok) {
			// superagent faultly thinks connection lost == crossDomain error, both probably look the same in xhr
			if (error && error.crossDomain) {
				self._onDisconnect();
				return;
			}
			var errorSummary = 'unknown';
			if (res) {
				if (res.body) {
					if (res.body.errorCode && res.body.errorCode != 'unknown') errorSummary = res.body.errorCode;
					else if (typeof(res.body.error) == 'string') errorSummary = res.body.error.split('\n')[0];
					else errorSummary = JSON.stringify(res.body.error);
				}
				else errorSummary = res.xhr.statusText + ' ' + res.xhr.status;
			}
			var err = { errorSummary: errorSummary, error: error, path: path, res: res, errorCode: res && res.body ? res.body.errorCode : 'unknown' };
			if (callback && callback(err)) return;
			else self._onUnhandledBadBackendResponse(err);
		}
		else if (callback)
			callback(null, res.body);
	});
};
AppViewModel.prototype._onUnhandledBadBackendResponse = function(err) {
	if (ungit.config.bugtracking) {
		bugsense.addExtraData('data', JSON.stringify(err.res.body));
		bugsense.notify(new Error('Backend: ' + err.path + ', ' + err.errorSummary));
	}
	if (ungit.config.sendUsageStatistics) {
		Keen.addEvent('unhandled-backend-error', { version: ungit.version, userHash: ungit.userHash });
	}
}
