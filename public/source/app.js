
var crossroads = require('crossroads');
var signals = require('signals');
var ko = require('../vendor/js/knockout-2.2.1');
var ProgressBarViewModel = require('./controls').ProgressBarViewModel;
var dialogs = require('./dialogs');
var screens = require('./screens');


var AppViewModel = function(browseTo) {
	var self = this;
	this.browseTo = browseTo;
	this.path = ko.observable();
	this.dialog = ko.observable(null);
	this.isAuthenticated = ko.observable(!ungit.config.authentication);

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
		api.query('GET', '/userconfig', undefined, function(err, userConfig) {
			self.showBugtrackingNagscreen(!userConfig.bugtracking);
		});
	}
	this.programEvents = new signals.Signal();
	this.programEvents.add(function(event) {
		console.log('Event:', event);
	});
	api.query('GET', '/latestversion', undefined, function(err, version) {
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
			if (self.isAuthenticated()) return self.realContent();
			else return self.authenticationScreen;
		}
	});

	api.getCredentialsHandler = function(callback) {
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
	api.workingTreeChanged.signal.add(function(data) {
		if (self.content() && self.content() instanceof screens.PathViewModel && self.content().repository())
			self.content().repository().onWorkingTreeChanged();
	});
	api.gitDirectoryChanged.signal.add(function(data) {
		if (self.content() && self.content() instanceof screens.PathViewModel && self.content().repository())
			self.content().repository().onGitDirectoryChanged();
	});
}
module.exports = AppViewModel;
AppViewModel.prototype.template = 'app';
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
	api.query('GET', '/userconfig', undefined, function(err, userConfig) {
		if (err) return;
		userConfig.bugtracking = true;
		userConfig.sendUsageStatistics = true;
		api.query('POST', '/userconfig', userConfig, function(err) {
			if (err) return;
			self.showBugtrackingNagscreen(false);
		});
	});
}
AppViewModel.prototype.enableBugtracking = function() {
	var self = this;
	api.query('GET', '/userconfig', undefined, function(err, userConfig) {
		if (err) return;
		userConfig.bugtracking = true;
		api.query('POST', '/userconfig', userConfig, function(err) {
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