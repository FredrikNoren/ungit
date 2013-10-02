
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
	app.watchRepository(repoPath, function() { self.watcherReady(true); });
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

	this.fetchingProgressBar.start();
	var jobs = [];
	if (options.tags) jobs.push(function(done) { self.app.get('/remote/tags', { path: self.repoPath }, done); });
	if (options.nodes) jobs.push(function(done) { self.app.post('/fetch', { path: self.repoPath }, done);  });
	async.parallel(jobs, function(err, result) {
		self.app.programEvents.remove(programEventListener);
		self.fetchingProgressBar.stop();

		if (!err && options.tags) self.graph.setRemoteTags(result[0]);
	});
}

RepositoryViewModel.prototype.updateRemotes = function() {
	var self = this;
	this.app.get('/remotes', { path: this.repoPath }, function(err, remotes) {
		if (err && err.errorCode == 'not-a-repository') return true;
		if (err) return;
		self.remotes(remotes);
		self.graph.hasRemotes(remotes.length != 0);
	});
}

