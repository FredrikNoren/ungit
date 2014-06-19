
var ko = require('knockout');
var components = require('ungit-components');

components.register('textdiff', function(args) {
  return new TextDiffViewModel(args);
});

var TextDiffViewModel = function(args) {
  var self = this;
  this.filename = args.filename;
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.diffs = ko.observable();
  this.sha1 = args.sha1;
  this.oldMode = ko.observable();
  this.newMode = ko.observable();
  this.totalNumberOfLines = ko.observable(0);
  this.isLoadingAllLines = ko.observable(false);
  this.showLoadAllButton = ko.computed(function() {
    return !self.isLoadingAllLines() && self.diffs() && self.totalNumberOfLines() != self.diffs().length;
  });
  this.initialDisplayLineLimit = args.initialDisplayLineLimit ? args.initialDisplayLineLimit : 100;
}
TextDiffViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('textdiff', this, {}, parentElement);
}
TextDiffViewModel.prototype.loadAllLines = function(data, event) {
  event.stopImmediatePropagation();
  this.isLoadingAllLines(true);
  this.invalidateDiff();
}
TextDiffViewModel.prototype.getDiffArguments = function() {
  var args = {};
  args.file = this.filename;
  args.path = this.repoPath;
  args.sha1 = this.sha1 ? this.sha1 : '';
  args.maxNLines = this.isLoadingAllLines() ? 0 : this.initialDisplayLineLimit;

  return args;
}
TextDiffViewModel.prototype.invalidateDiff = function(callback) {
  var self = this;

  self.server.get('/diff', this.getDiffArguments() , function(err, diffs) {
    if (err) {
      if (err.errorCode == 'no-such-file') {
        // The file existed before but has been removed, but we're trying to get a diff for it
        // Most likely it will just disappear with the next refresh of the staging area
        // so we just ignore the error here
        return true;
      }
      return callback ? callback(err) : null;
    }
    var newDiffs = [];
    diffs.forEach(function(diff) {
      diff.lines.forEach(
        function(line) {
          newDiffs.push({
            oldLineNumber: line[0],
            newLineNumber: line[1],
            added: line[2][0] == '+',
            removed: line[2][0] == '-' || line[2][0] == '\\',
            text: line[2]
          });
        }
      );
      if (diff.aMode && diff.bMode) {
        self.oldMode(diff.aMode[1]);
        self.newMode(diff.bMode[1]);

        newDiffs.push({
          oldLineNumber: '-',
          newLineNumber: '-',
          added: false,
          removed: false,
          text: 'Mode changed from ' + self.oldMode() + ' to ' + self.newMode()
        });
      }
    });

    self.diffs(newDiffs);
    self.totalNumberOfLines(diffs[0] ? diffs[0].totalNumberOfLines : 0);

    if (callback) callback();
  });
}

