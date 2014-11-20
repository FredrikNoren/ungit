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
  this.type = ko.computed(function() {
    if (!self.fileName()) {
      return 'textdiff';
    }

    if (fileType(self.fileName()) == 'text') {
      return 'textdiff'//args.diffTextDisplayType()
    } else {
      return 'imagediff';
    }
  });
  this.specificDiff = ko.observable(components.create(this.type(), {
    filename: this.fileName(),
    repoPath: args.repoPath,
    server: args.server,
    sha1: args.sha1,
    initialDisplayLineLimit: 50     //Image diff doesn't use this so it doesn't matter.
  }));

  args.diffTextDisplayType.subscribe(function() {
    if (self.showSpecificDiff()) {
      self.refreshAndShow();
    }
  });
};
exports.CommitLineDiff = CommitLineDiff;

CommitLineDiff.prototype.fileNameClick = function(data, event) {
  if (this.showSpecificDiff()) {
    this.showSpecificDiff(false);
  } else {
    this.refreshAndShow();
  }
  event.stopImmediatePropagation();
};

CommitLineDiff.prototype.refreshAndShow = function() {
  var self = this;
  this.specificDiff().invalidateDiff(function() {
    self.showSpecificDiff(true);
  });
}
