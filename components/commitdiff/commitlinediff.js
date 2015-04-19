var ko = require('knockout');
var components = require('ungit-components');
var inherits = require('util').inherits;
var fileType = require('../../source/utils/file-type.js');

var CommitLineDiff = function(args) {
  var self = this;
  this.added = ko.observable(args.fileLineDiff[0]);
  this.removed = ko.observable(args.fileLineDiff[1]);
  this.fileName = ko.observable(args.fileLineDiff[2]);
  this.showSpecificDiff = ko.observable(false);
  this.specificDiff = ko.observable(this.getSpecificDiff());
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.sha1 = args.sha1;
  this.textDiffType = args.textDiffType;
};
exports.CommitLineDiff = CommitLineDiff;

CommitLineDiff.prototype.getSpecificDiff = function() {
  return components.create(!this.fileName() || fileType(this.fileName()) == 'text' ? 'textdiff' : 'imagediff', {
    filename: this.fileName(),
    repoPath: this.repoPath,
    server: this.server,
    sha1: this.sha1,
    textDiffType: this.textDiffType,
    showingDiffs: this.showSpecificDiff
  });
}

CommitLineDiff.prototype.fileNameClick = function() {
  if (this.showSpecificDiff()) {
    this.showSpecificDiff(false);
  } else {
    this.showSpecificDiff(true);
    this.specificDiff().invalidateDiff();
  }
};
