
var signals = require('signals');
var ko = require('../vendor/js/knockout-2.2.1');
var dialogs = require('./dialogs');
var screens = require('./screens');
var blockable = require('../../source/utils/blockable');
var _ = require('lodash');
var superagent = require('../vendor/js/superagent');


var AppViewModel = function(browseTo) {
	var self = this;
	this.browseTo = browseTo;
	this.path = ko.observable();
	this.dialog = ko.observable(null);
	this.connectionState = ko.observable('connecting');
	this.gitErrors = ko.observable([]);

	this.visitedRepositories = ko.computed({
		read: function() {
			return JSON.parse(localStorage.getItem('visitedRepositories') || '[]');
		},
		write: function(value) {
			localStorage.setItem('visitedRepositories', JSON.stringify(value));
		}
	});

	this.content = ko.observable(new screens.HomeViewModel(this));
	this.currentVersion = ko.observable();
	this.latestVersion = ko.observable();
	this.newVersionAvailable = ko.observable();
	this.bugtrackingEnabled = ko.observable(ungit.config.bugtracking);

	this.bugtrackingNagscreenDismissed = ko.computed({
		read: function() { return localStorage.getItem('bugtrackingNagscreenDismissed'); },
		write: function(value) { localStorage.setItem('bugtrackingNagscreenDismissed', value); }
	})
	this.showBugtrackingNagscreen = ko.computed(function() {
		return !self.bugtrackingEnabled() && !self.bugtrackingNagscreenDismissed();
	});
	this.programEvents = new signals.Signal();
	this.programEvents.add(function(event) {
		console.log('Event:', event);
	});

	this.workingTreeChanged = blockable(_.throttle(function() {
		if (self.content() && self.content() instanceof screens.PathViewModel && self.content().repository())
			self.content().repository().onWorkingTreeChanged();
	}, 500));
	this.gitDirectoryChanged = blockable(_.throttle(function() {
		if (self.content() && self.content() instanceof screens.PathViewModel && self.content().repository())
			self.content().repository().onGitDirectoryChanged();
	}, 500));
}
module.exports = AppViewModel;
AppViewModel.prototype.template = 'app';
AppViewModel.prototype.shown = function() {
	var self = this;
	// The ungit.config variable collections configuration from all different paths and only updates when
	// ungit is restarted
	if(!ungit.config.bugtracking) {
		// Whereas the userconfig only reflects what's in the ~/.ungitrc and updates directly,
		// but is only used for changing around the configuration. We need to check this here
		// since ungit may have crashed without the server crashing since we enabled bugtracking,
		// and we don't want to show the nagscreen twice in that case.
		this.get('/userconfig', undefined, function(err, userConfig) {
			self.bugtrackingEnabled(userConfig.bugtracking);
		});
	}

	this.get('/latestversion', undefined, function(err, version) {
		self.currentVersion(version.currentVersion);
		self.latestVersion(version.latestVersion);
		self.newVersionAvailable(version.outdated);
	});
}
AppViewModel.prototype.initSocket = function(callback) {
	var self = this;
	this.socket = io.connect();
	this.socket.on('error', function(err) {
		self._isConnected(function(connected) {
			if (connected) throw err;
			else self._onDisconnect();
		});
	});
	this.socket.on('disconnect', function() {
		self._onDisconnect();
	});
	this.socket.on('connected', function (data) {
		self.socketId = data.socketId;
		self.connectionState('connected');
		callback();
	});
	this.socket.on('working-tree-changed', function () {
		self.workingTreeChanged();
	});
	this.socket.on('git-directory-changed', function () {
		self.gitDirectoryChanged();
	});
	this.socket.on('request-credentials', function () {
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
			self.bugtrackingEnabled(true);
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
			self.bugtrackingEnabled(true);
		});
	});
}
AppViewModel.prototype.dismissBugtrackingNagscreen = function() {
	this.bugtrackingNagscreenDismissed(true);
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

AppViewModel.prototype._skipReportErrorCodes = [
	'remote-timeout',
	'permision-denied-publickey',
	'no-supported-authentication-provided',
	'offline',
	'proxy-authentication-required',
	'no-remote-configured',
	'ssh-bad-file-number'
];
AppViewModel.prototype._backendErrorCodeToTip = {
	'remote-timeout': 'Repository remote timeouted.',
	'no-supported-authentication-provided': 'No supported authentication methods available. Try starting ssh-agent or pageant.',
	'offline': 'Couldn\'t reach remote repository, are you offline?',
	'proxy-authentication-required': 'Proxy error; proxy requires authentication.',
	'no-remote-configured': 'No remote to list refs from.',
	'ssh-bad-file-number': 'Got "Bad file number" error. This usually indicates that the port listed for the remote repository can\'t be reached.',
	'non-fast-forward': 'Couldn\'t push, things have changed on the server. Try fetching new nodes.'
};
AppViewModel.prototype._onUnhandledBadBackendResponse = function(err) {
	var self = this;
	// Show a error screen for git errors (so that people have a chance to debug them)
	if (err.res.body && err.res.body.isGitError) {

		// Handle not-a-repository errors (for instance if the user removes the .git directory)
		if (err.res.body.errorCode == 'not-a-repository') {
			this.content(new screens.PathViewModel(this, this.path()));
			return;
		}


		// Skip report is used for "user errors"; i.e. it's something ungit can't really do anything about.
		// It's still shown in the ui but we don't send a bug report since we can't do anything about it anyways
		var shouldSkipReport = this._skipReportErrorCodes.indexOf(err.errorCode) >= 0;
		if (!shouldSkipReport) {
			if (ungit.config.bugtracking) {

				var extra = {
					stdout: err.res.body.stdout.slice(0, 100),
					stderr: err.res.body.stderr.slice(0, 100),
					path: err.path,
					summary: err.errorSummary,
					stacktrace: err.res.body.stackAtCall.slice(0, 300),
					lineNumber: err.res.body.lineAtCall,
					command: err.res.body.command
				}

				var name = 'GitError: ' + (err.res.body.stackAtCall || '').split('\n')[3] + err.errorSummary;

				Raven.captureException(name, { extra: extra, tags: { subsystem: 'git' } });
			}
			if (ungit.config.sendUsageStatistics) {
				Keen.addEvent('git-error', { version: ungit.version, userHash: ungit.userHash });
			}
			console.log('git-error', err); // Used by the clicktests
		}
		var gitErrors = this.gitErrors();
		gitErrors.push({
			tip: self._backendErrorCodeToTip[err.errorCode],
			command: err.res.body.command,
			error: err.res.body.error,
			stdout: err.res.body.stdout,
			stderr: err.res.body.stderr,
			showEnableBugtracking: ko.computed(function() { return !self.bugtrackingEnabled() && !shouldSkipReport; }),
			bugReportWasSent: ungit.config.bugtracking,
			enableBugtrackingAndStatistics: self.enableBugtrackingAndStatistics.bind(self),
			enableBugtracking: self.enableBugtracking.bind(self),
			dismiss: function() {
				var t = this;
				var gitErrors = self.gitErrors();
				gitErrors = gitErrors.filter(function(e) { return e != t; });
				self.gitErrors(gitErrors);
			}
		});
		this.gitErrors(gitErrors);
	} 
	// Everything else is just thrown
	else {
		throw new Error(err.errorSummary);
	}
}
