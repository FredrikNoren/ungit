var ko = require('knockout');
var components = require('ungit-components');
var inherits = require('util').inherits;
var fileType = require('../../source/utils/file-type.js');

var CommitLineDiff = function(args) {
  var self = this;
  this.added = ko.observable(args.fileLineDiff[0]);
  this.removed = ko.observable(args.fileLineDiff[1]);
  this.fileName = ko.observable(args.fileLineDiff[2]);
  this.isShowingDiffs = ko.observable(false);
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.sha1 = args.sha1;
  this.textDiffType = args.textDiffType;
  this.specificDiff = ko.observable(this.getSpecificDiff());
};
exports.CommitLineDiff = CommitLineDiff;

CommitLineDiff.prototype.getSpecificDiff = function() {
  return components.create(!this.fileName() || fileType(this.fileName()) == 'text' ? 'textdiff' : 'imagediff', {
    filename: this.fileName(),
    repoPath: this.repoPath,
    server: this.server,
    sha1: this.sha1,
    textDiffType: this.textDiffType,
    isShowingDiffs: this.isShowingDiffs
  });
}

CommitLineDiff.prototype.fileNameClick = function() {
  if (this.isShowingDiffs()) {
    this.isShowingDiffs(false);
  } else {
    this.isShowingDiffs(true);
    this.specificDiff().invalidateDiff();
  }
};
