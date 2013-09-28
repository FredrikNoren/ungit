
var ko = require('../vendor/js/knockout-2.2.1');
var ProgressBarViewModel = require('./controls').ProgressBarViewModel;
var GitGraphViewModel = require('./git-graph').GitGraphViewModel;
var async = require('async');
var GerritIntegrationViewModel = require('./gerrit').GerritIntegrationViewModel;
var StagingViewModel = require('./staging').StagingViewModel;

var idCounter = 0;
var newId = function() { return idCounter++; };


var RepositoryViewModel = function(app, repoPath) {
	var self = this;
	this.remoteErrorPopup = ko.observable();

	this.app = app;
	this.repoPath = repoPath;
	this.gerritIntegration = ko.observable(null);
	this.fetchingProgressBar = new ProgressBarViewModel('fetching-' + this.repoPath);
	this.graph = new GitGraphViewModel(this);
	this.staging = new StagingViewModel(this);
	this.remotes = ko.observable();
	this.showFetchButton = ko.computed(function() {
		return self.graph.hasRemotes();
	});
	this.watcherReady = ko.observable(false);
	this.showLog = ko.computed(function() {
		return !self.staging.inRebase() && !self.staging.inMerge();
	});
	api.watchRepository(repoPath, function() { self.watcherReady(true); });
	if (ungit.config.gerrit) {
		self.gerritIntegration(new GerritIntegrationViewModel(self));
	}
	var hasAutoFetched = false;
	this.remotes.subscribe(function(newValue) {
		if (newValue.length > 0 && !hasAutoFetched && ungit.config.autoFetch) {
			hasAutoFetched = true;
			self.fetch({ nodes: true, tags: true });
		}
	});

	self.onWorkingTreeChanged();
	self.onGitDirectoryChanged();
}
exports.RepositoryViewModel = RepositoryViewModel;
RepositoryViewModel.prototype.onWorkingTreeChanged = function() {
	this.staging.refresh();
	this.staging.invalidateFilesDiffs();
}
RepositoryViewModel.prototype.onGitDirectoryChanged = function() {
	this.graph.loadNodesFromApi();
	this.graph.updateBranches();
	this.updateRemotes();
}
RepositoryViewModel.prototype.closeRemoteErrorPopup = function() {
	this.remoteErrorPopup(null);
}
RepositoryViewModel.prototype.updateAnimationFrame = function(deltaT) {
	this.graph.updateAnimationFrame(deltaT);
}
RepositoryViewModel.prototype.clickFetch = function() { this.fetch({ nodes: true, tags: true }); }
RepositoryViewModel.prototype.fetch = function(options, callback) {
	var self = this;

	var programEventListener = function(event) {
		if (event.event == 'credentialsRequested') self.fetchingProgressBar.pause();
		else if (event.event == 'credentialsProvided') self.fetchingProgressBar.unpause();
	};
	this.app.programEvents.add(programEventListener);

	var handleApiRemoteError = function(callback, err, result) {
		callback(err, result);
		return !err || self._isRemoteError(err.errorCode);
	}

	this.fetchingProgressBar.start();
	var jobs = [];
	var remoteTags;
	if (options.nodes) jobs.push(function(done) { api.query('POST', '/fetch', { path: self.repoPath, socketId: api.socketId }, function(err, result) {
			done(err, result);
			return !err || self._isRemoteError(err.errorCode);
		}); 
	});
	if (options.tags) jobs.push(function(done) { api.query('GET', '/remote/tags', { path: self.repoPath, socketId: api.socketId }, function(err, result) {
			remoteTags = result;
			done(err, result);
			return !err || self._isRemoteError(err.errorCode);
		});
	});
	async.parallel(jobs, function(err, result) {
		self.app.programEvents.remove(programEventListener);
		self.fetchingProgressBar.stop();

		if (err) {
			self.remoteErrorPopup(self._remoteErrorCodeToString[err.errorCode]);
			return true;
		}

		if (options.tags) self.graph.setRemoteTags(remoteTags);
	});
}
RepositoryViewModel.prototype._remoteErrorCodeToString = {
	'remote-timeout': 'Repository remote timeouted.',
	'permision-denied-publickey': 'Permission denied (publickey).',
	'no-supported-authentication-provided': 'No supported authentication methods available. Try starting ssh-agent or pageant.',
	'offline': 'Couldn\'t reach remote repository, are you offline?',
	'proxy-authentication-required': 'Proxy error; proxy requires authentication.',
	'no-remote-configured': 'No remote to list refs from.',
	'ssh-bad-file-number': 'Got "Bad file number" error. This usually indicates that the port listed for the remote repository can\'t be reached.'
}
RepositoryViewModel.prototype._isRemoteError = function(errorCode) {
	return !!this._remoteErrorCodeToString[errorCode];
}

RepositoryViewModel.prototype.updateRemotes = function() {
	var self = this;
	api.query('GET', '/remotes', { path: this.repoPath }, function(err, remotes) {
		if (err && err.errorCode == 'not-a-repository') return true;
		if (err) return;
		self.remotes(remotes);
		self.graph.hasRemotes(remotes.length != 0);
	});
}

