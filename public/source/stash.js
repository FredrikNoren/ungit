
var ko = require('knockout');
var moment = require('moment');
var ProgressBarViewModel = require('./controls').ProgressBarViewModel;

function StashItemViewModel(stash, data) {
  this.stash = stash;
  this.app = stash.app;
  this.id = data.id;
  this.title = data.name + ' ' + moment(data.date).fromNow();
  this.body = data.title;
  this.stashPopProgressBar = new ProgressBarViewModel('stash-pop');
}
StashItemViewModel.prototype.pop = function() {
  var self = this;
  this.stashPopProgressBar.start();
  this.app.del('/stashes/' + this.id, { path: this.stash.repository.repoPath, pop: true }, function(err, res) {
    self.stashPopProgressBar.stop();
  });
}
StashItemViewModel.prototype.drop = function() {
  var self = this;
  this.stashPopProgressBar.start();
  this.app.del('/stashes/' + this.id, { path: this.stash.repository.repoPath }, function(err, res) {
    self.stashPopProgressBar.stop();
  });
}

function StashViewModel(repository) {
  var self = this;
  this.repository = repository;
  this.app = repository.app;
  this.stashedChanges = ko.observable([]);
  this.visible = ko.computed(function() { return self.stashedChanges().length > 0; });
}
StashViewModel.prototype.refresh = function() {
  var self = this;
  this.app.get('/stashes', { path: this.repository.repoPath }, function(err, stashes) {
    if (err) return;
    self.stashedChanges(stashes.map(function(item) { return new StashItemViewModel(self, item); }));
  });
}

module.exports = StashViewModel;