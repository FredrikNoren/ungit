
var ko = require('knockout');
var components = require('ungit-components');
var diff2html = require('diff2html').Diff2Html;

components.register('textdiff', function(args) {
  return new TextDiffViewModel(args);
});

var loadLimit = 100;

var TextDiffViewModel = function(args) {
  var self = this;
  this.filename = args.filename;
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.sha1 = args.sha1;
  this.loadMoreCount = ko.observable(0);
  this.diffJson = null;
  this.diffHtml = ko.observable();
  this.loadCount = loadLimit;
  this.textDiffType = args.textDiffType;
  this.isShowingDiffs = args.isShowingDiffs;
  this.diffProgressBar = args.diffProgressBar;

  this.textDiffType.subscribe(function() {
    self.invalidateDiff();
  });
}
TextDiffViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('textdiff', this, {}, parentElement);
}
TextDiffViewModel.prototype.getDiffArguments = function() {
  return {
    file: this.filename,
    path: this.repoPath,
    sha1: this.sha1 ? this.sha1 : ''
  };
}

TextDiffViewModel.prototype.invalidateDiff = function(callback) {
  var self = this;

  if (this.isShowingDiffs()) {
    if (this.diffProgressBar) this.diffProgressBar.start();

    self.server.get('/diff', this.getDiffArguments() , function(err, diffs) {
      if (err) {
        if (self.diffProgressBar) self.diffProgressBar.stop();
        if (err.errorCode == 'no-such-file') {
          // The file existed before but has been removed, but we're trying to get a diff for it
          // Most likely it will just disappear with the next refresh of the staging area
          // so we just ignore the error here
          return true;
        }
        return callback ? callback(err) : null;
      }

      if (typeof diffs == 'string') {
        self.diffJson = diff2html.getJsonFromDiff(diffs);
        self.render();
      }

      if (self.diffProgressBar) self.diffProgressBar.stop();
      if (callback) callback();
    });
  } else {
    if (callback) callback();
  }
}

TextDiffViewModel.prototype.render = function() {
  if (this.diffJson.length == 0) return; // check if diffs are available (binary files do not support them)

  var self = this;
  var diffJsonCopy = JSON.parse(JSON.stringify(this.diffJson)); // make a json copy
  var lineCount = 0;

  diffJsonCopy[0].blocks = diffJsonCopy[0].blocks.reduce(function(blocks, block) {
    var length = block.lines.length;
    if (lineCount < self.loadCount) {
      block.lines = block.lines.slice(0, self.loadCount - lineCount);
      blocks.push(block);
    }
    lineCount += length;
    return blocks;
  }, []);

  this.loadMoreCount(Math.min(loadLimit, Math.max(0, lineCount - this.loadCount)));

  if (this.textDiffType() === 'sidebysidediff') {
    this.diffHtml(diff2html.getPrettySideBySideHtmlFromJson(diffJsonCopy));
  } else {
    this.diffHtml(diff2html.getPrettyHtmlFromJson(diffJsonCopy));
  }
};

TextDiffViewModel.prototype.loadMore = function(callback) {
  this.loadCount += this.loadMoreCount();
  this.render();
}
