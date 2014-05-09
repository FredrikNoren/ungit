var ko = require('knockout');
var CommitLineDiff = require('./commitlinediff.js').CommitLineDiff;
var components = require('ungit-components');

components.register('commitDiff', function(args) {
  return new CommitDiff(args);
});

var CommitDiff = function(args) {
  this.totalLineDiffs = ko.observable();
  this.commitLineDiffs = ko.observable([]);
  this.showLoadMore = ko.observable();
  this.server = args.server;
  this.sha1 = args.sha1;
  this.repoPath = args.repoPath;
  this.maxNumberOfFilesShown = 50;

  var totalLineDiffs = args.fileLineDiffs.shift();
  if (!totalLineDiffs) {
    this.totalLineDiffs([0, 0, 'total']);
  } else {
    this.totalLineDiffs(totalLineDiffs);
  }

  this.checkShowLoadMore(args.fileLineDiffs.length);
  this.loadFileLineDiffs(args);
};

CommitDiff.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('commitdiff', this, {}, parentElement);
};

CommitDiff.prototype.checkShowLoadMore = function(size) {
  if (size < this.maxNumberOfFilesShown) {
    this.showLoadMore(false);
  } else {
    this.showLoadMore(true);
  }
};

CommitDiff.prototype.loadFileLineDiffs = function(args) {
  var tempCommitLineDiffs = [];
  var lineDiffLength = this.commitLineDiffs().length;

  args.fileLineDiffs.slice(lineDiffLength === 0 ? 0 : lineDiffLength + 1, this.maxNumberOfFilesShown).forEach(function(fileLineDiff) {
    args.fileLineDiff = fileLineDiff;
    tempCommitLineDiffs.push(new CommitLineDiff(args));
  });

  this.commitLineDiffs(this.commitLineDiffs().concat(tempCommitLineDiffs));
}

CommitDiff.prototype.loadMore = function(data, event) {
  this.maxNumberOfFilesShown += 50;
  var self = this;

  this.server.get('/show', { path: this.repoPath, sha1: this.sha1 }, function(err, logEntries) {
    if (err || !logEntries || !logEntries[0]) {
      return;
    }
    self.checkShowLoadMore(logEntries[0].fileLineDiffs.length);
    self.loadFileLineDiffs({
      repoPath: self.repoPath,
      server: self.server,
      sha1: self.sha1,
      fileLineDiffs: logEntries[0].fileLineDiffs
    });
  });
  event.stopImmediatePropagation();
}