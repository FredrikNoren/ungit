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
  this.args = args;
  this.type = ko.computed(function() {
    if (!self.fileName()) {
      return 'textdiff';
    }

    if (fileType(self.fileName()) == 'text') {
      return args.textDiffType();
    } else {
      return 'imagediff';
    }
  });
  this.specificDiff = ko.observable(this.getSpecificDiff());

  args.textDiffType.subscribe(function() {
    self.specificDiff(self.getSpecificDiff());
    self.refreshAndShow();
  });
};
exports.CommitLineDiff = CommitLineDiff;

CommitLineDiff.prototype.getSpecificDiff = function() {
  return components.create(this.type(), {
    filename: this.fileName(),
    repoPath: this.args.repoPath,
    server: this.args.server,
    sha1: this.args.sha1,
    initialDisplayLineLimit: 50     //Image diff doesn't use this so it doesn't matter.
  });
}

CommitLineDiff.prototype.fileNameClick = function(data, event) {
  if (this.showSpecificDiff()) {
    this.showSpecificDiff(false);
  } else {
    this.refreshAndShow();
  }
};

CommitLineDiff.prototype.refreshAndShow = function() {
  var self = this;
  if (this.showSpecificDiff()) {
    this.specificDiff().invalidateDiff(function() {
      self.showSpecificDiff(true);
    });
  }
}
