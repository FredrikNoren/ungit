
var ko = require('knockout');
var components = require('ungit-components');

components.register('textdiff', function(args) {
  return new TextDiffViewModel(args);
});

var TextDiffViewModel = function(args) {
  this.filename = args.filename;
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.diffs = ko.observable();
  this.sha1 = args.sha1;
}
TextDiffViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('textdiff', this, {}, parentElement);
}
TextDiffViewModel.prototype.invalidateDiff = function(callback) {
  var self = this;

  self.server.get('/diff', { file: self.filename, path: self.repoPath, sha1: self.sha1 ? self.sha1 : '' }, function(err, diffs) {
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
    });
    self.diffs(newDiffs);
    if (callback) callback();
  });
}

