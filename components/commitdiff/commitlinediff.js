var ko = require('knockout');
var components = require('ungit-components');
var inherits = require('util').inherits;
var programEvents = require('ungit-program-events');

var CommitLineDiff = function(args, fileLineDiff) {
  this.added = ko.observable(fileLineDiff[0]);
  this.removed = ko.observable(fileLineDiff[1]);
  this.fileName = ko.observable(fileLineDiff[2]);
  this.fileType = fileLineDiff[3];
  this.isShowingDiffs = ko.observable(false);
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.sha1 = args.sha1;
  this.textDiffType = args.textDiffType;
  this.wordWrap = args.wordWrap;
  this.whiteSpace = args.whiteSpace;
  this.specificDiff = ko.observable(this.getSpecificDiff());
};
exports.CommitLineDiff = CommitLineDiff;

CommitLineDiff.prototype.getSpecificDiff = function() {
  return components.create(this.fileType + 'diff', {
    filename: this.fileName(),
    repoPath: this.repoPath,
    server: this.server,
    sha1: this.sha1,
    textDiffType: this.textDiffType,
    isShowingDiffs: this.isShowingDiffs,
    whiteSpace: this.whiteSpace,
    wordWrap: this.wordWrap
  });
}

CommitLineDiff.prototype.fileNameClick = function() {
  this.isShowingDiffs(!this.isShowingDiffs());
  this.specificDiff().invalidateDiff(function() {
    programEvents.dispatch({ event: 'graph-render' });
  });
};
