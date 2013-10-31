
var ko = require('../vendor/js/knockout-2.2.1');
var ProgressBarViewModel = require('./controls').ProgressBarViewModel;
var GitGraphViewModel = require('./git-graph').GitGraphViewModel;
var async = require('async');
var GerritIntegrationViewModel = require('./gerrit').GerritIntegrationViewModel;
var StagingViewModel = require('./staging').StagingViewModel;
var dialogs = require('./dialogs');
var _ = require('lodash');

var idCounter = 0;
var newId = function() { return idCounter++; };


var RepositoryViewModel = function(app, repoPath) {
	var self = this;

	this.app = app;
	this.repoPath = repoPath;
	this.gerritIntegration = ko.observable(null);
	this.graph = new GitGraphViewModel(this);
	this.remotes = new RemotesViewModel(this);
	this.staging = new StagingViewModel(this);
	this.watcherReady = ko.observable(false);
	this.showLog = ko.computed(function() {
		return !self.staging.inRebase() && !self.staging.inMerge();
	});
	app.watchRepository(repoPath, function() { self.watcherReady(true); });
	if (ungit.config.gerrit) {
		self.gerritIntegration(new GerritIntegrationViewModel(self));
	}

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
	this.remotes.updateRemotes();
}
RepositoryViewModel.prototype.updateAnimationFrame = function(deltaT) {
	this.graph.updateAnimationFrame(deltaT);
}
RepositoryViewModel.prototype.handleBubbledClick = function(elem, event) {
	// If the clicked element is bound to the current action context,
	// then let's not deselect it.
	if (ko.dataFor(event.target) === this.graph.currentActionContext()) return;
	this.graph.currentActionContext(null);
	// If the click was on an input element, then let's allow the default action to proceed.
	// This is especially needed since for some strange reason any submit (ie. enter in a textbox)
	// will trigger a click event on the submit input of the form, which will end up here,
	// and if we don't return true, then the submit event is never fired, breaking stuff.
	if (event.target.nodeName === 'INPUT') return true;
}


function RemotesViewModel(repository) {
	var self = this;
	this.repository = repository;
	this.repoPath = repository.repoPath;
	this.app = repository.app;
	this.remotes = ko.observable([]);
	this.currentRemote = ko.observable(null);
	this.fetchLabel = ko.computed(function() {
		if (self.currentRemote()) return 'Fetch nodes from ' + self.currentRemote();
		else return 'No remotes specified';
	})

	this.fetchingProgressBar = new ProgressBarViewModel('fetching-' + this.repoPath);

	this.fetchEnabled = ko.computed(function() {
		return self.remotes().length > 0 && !self.fetchingProgressBar.running();
	});

	this.shouldAutoFetch = ungit.config.autoFetch;
}
RemotesViewModel.prototype.clickFetch = function() { this.fetch({ nodes: true, tags: true }); }
RemotesViewModel.prototype.fetch = function(options, callback) {
	var self = this;

	var programEventListener = function(event) {
		if (event.event == 'credentialsRequested') self.fetchingProgressBar.pause();
		else if (event.event == 'credentialsProvided') self.fetchingProgressBar.unpause();
	};
	this.app.programEvents.add(programEventListener);

	this.fetchingProgressBar.start();
	var jobs = [];
	if (options.tags) jobs.push(function(done) { self.app.get('/remote/tags', { path: self.repoPath, remote: self.currentRemote() }, done); });
	if (options.nodes) jobs.push(function(done) { self.app.post('/fetch', { path: self.repoPath, remote: self.currentRemote() }, done);  });
	async.parallel(jobs, function(err, result) {
		self.app.programEvents.remove(programEventListener);
		self.fetchingProgressBar.stop();

		if (!err && options.tags) self.repository.graph.setRemoteTags(result[0]);
	});
}

RemotesViewModel.prototype.updateRemotes = function() {
	var self = this;
	this.app.get('/remotes', { path: this.repoPath }, function(err, remotes) {
		if (err && err.errorCode == 'not-a-repository') return true;
		if (err) return;
		remotes = remotes.map(function(remote) {
			return {
				name: remote,
				changeRemote: function() { self.currentRemote(remote) }
			}
		});
		self.remotes(remotes);
		self.repository.graph.hasRemotes(remotes.length != 0);
		if (!self.currentRemote() && remotes.length > 0) {
			if (_.find(remotes, { 'name': 'origin' })) // default to origin if it exists
				self.currentRemote('origin');
			else // otherwise take the first one
				self.currentRemote(remotes[0].name);
			if (self.shouldAutoFetch) {
				self.fetch({ nodes: true, tags: true });
			}
		}
		self.shouldAutoFetch = false;
	});
}
RemotesViewModel.prototype.showAddRemoteDialog = function() {
	var self = this;
	var diag = new dialogs.AddRemoteDialogViewModel();
	diag.closed.add(function() {
		if (diag.isSubmitted()) {
			self.app.post('/remotes/' + encodeURIComponent(diag.name()), { path: self.repoPath, url: diag.url() }, function(err, res) {
				if (err) return;
				self.updateRemotes();
			})
		}
	});
	this.app.showDialog(diag);
}
