
var ko = require('../vendor/js/knockout-2.2.1');
var ProgressBarViewModel = require('./controls').ProgressBarViewModel;
var _ = require('lodash');


var GerritIntegrationViewModel = function(repository) {
	this.repository = repository;
	this.app = repository.app;
	this.showInitCommmitHook = ko.observable(false);
	this.status = ko.observable('loading');
	this.initGerritHookProgressBar = new ProgressBarViewModel('gerrit-init-hook-' + repository.repoPath, 4000);
	this.changesLoader = new ProgressBarViewModel('gerrit-changes-' + repository.repoPath, 4000);
	this.pushingProgressBar = new ProgressBarViewModel('gerrit-push-' + repository.repoPath, 4000);
	this.changes = ko.observable();
	this.updateCommitHook();
	this.updateChanges();
}
exports.GerritIntegrationViewModel = GerritIntegrationViewModel;
GerritIntegrationViewModel.prototype.updateCommitHook = function() {
	var self = this;
	this.app.get('/gerrit/commithook', { path: this.repository.repoPath }, function(err, hook) {
		self.showInitCommmitHook(!hook.exists);
	});
}
GerritIntegrationViewModel.prototype.updateChanges = function() {
	var self = this;
	self.status('loading');
	this.changesLoader.start();
	this.app.get('/gerrit/changes', { path: this.repository.repoPath }, function(err, changes) {
		self.changesLoader.stop();
		if (err) {
			self.status('failed');
			return true;
		}
		self.changes(changes.slice(0, changes.length - 1).map(function(c) { return new GerritChangeViewModel(self, c); }));
		self.status('loaded');
	});
}
GerritIntegrationViewModel.prototype.initCommitHook = function() {
	var self = this;
	this.initGerritHookProgressBar.start();
	this.app.post('/gerrit/commithook', { path: this.repository.repoPath }, function(err) {
		self.updateCommitHook();
		self.initGerritHookProgressBar.stop();
	});
}
GerritIntegrationViewModel.prototype.getChange = function(changeId) {
	return _.find(this.changes(), { data: { id: changeId } });
}
GerritIntegrationViewModel.prototype.getChangeIdFromMessage = function(message) {
	var changeId = message.split('\n').pop().trim();
	if (changeId && changeId.indexOf('Change-Id: ') == 0) {
		return changeId.slice('Change-Id: '.length).trim();
	}
}
GerritIntegrationViewModel.prototype.getChangeFromNode = function(node) {
	var changeId = this.getChangeIdFromMessage(node.message());
	if (!changeId) return;
	return this.getChange(changeId);
}
GerritIntegrationViewModel.prototype.pushForReview = function() {
	var self = this;
	this.pushingProgressBar.start();
	var branch = this.repository.graph.checkedOutBranch();
	var change = this.getChangeFromNode(this.repository.graph.HEAD());
	if (change) branch = change.data.branch;

	this.app.post('/push', { path: this.repository.graph.repoPath, remote: this.repository.remotes.currentRemote(), remoteBranch: 'refs/for/' + branch }, function(err, res) {
		self.updateChanges();
		self.pushingProgressBar.stop();
	});
}

var GerritChangeViewModel = function(gerritIntegration, args) {
	this.gerritIntegration = gerritIntegration;
	this.repository = gerritIntegration.repository;
	this.app = gerritIntegration.app;
	this.subject = args.subject;
	this.ownerName = args.owner.name;
	this.sha1 = args.sha1;
	this.data = args;
	this.gerritUrl = this.data.url;
	this.checkingOutProgressBar = new ProgressBarViewModel('gerrit-checkout-' + this.repository.repoPath, 4000);
	this.cherryPickingProgressBar = new ProgressBarViewModel('gerrit-cherry-pick-' + this.repository.repoPath, 4000);
};
GerritChangeViewModel.prototype.checkout = function() {
	var self = this;
	this.checkingOutProgressBar.start();
	this.app.post('/fetch', { path: this.gerritIntegration.repository.repoPath, remote: self.gerritIntegration.repository.remotes.currentRemote(), ref: this.data.currentPatchSet.ref }, function(err) {
		self.app.post('/checkout', { path: self.gerritIntegration.repository.repoPath, name: 'FETCH_HEAD' }, function(err) {
			self.checkingOutProgressBar.stop();
		});
	});
}
GerritChangeViewModel.prototype.cherryPick = function() {
	var self = this;
	this.cherryPickingProgressBar.start();
	this.app.post('/fetch', { path: this.gerritIntegration.repository.repoPath, remote: self.gerritIntegration.repository.remotes.currentRemote(), ref: this.data.currentPatchSet.ref }, function(err) {
		self.app.post('/cherrypick', { path: self.gerritIntegration.repository.repoPath, name: 'FETCH_HEAD' }, function(err) {
			self.cherryPickingProgressBar.stop();
		});
	});
}
