
var ko = require('../vendor/js/knockout-2.2.1');
var moment = require('moment');

function StashItemViewModel(stash, data) {
  this.stash = stash;
  this.app = stash.app;
  this.id = data.id;
  this.title = data.name + ' ' + moment(data.date).fromNow();
  this.body = data.title;
}
StashItemViewModel.prototype.pop = function() {
  this.app.del('/stashes/' + this.id, { path: this.stash.repository.repoPath, pop: true });
}
StashItemViewModel.prototype.drop = function() {
  this.app.del('/stashes/' + this.id, { path: this.stash.repository.repoPath });
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
    self.stashedChanges(stashes.map(function(item) { return new StashItemViewModel(self, item); }));
  });
}

module.exports = StashViewModel;