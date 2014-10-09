var ko = require('knockout');
var components = require('ungit-components');
var inherits = require('util').inherits;
var fileType = require('../../source/utils/file-type.js');

components.register('getFileType', function(args) {
  return getFileType(args.fileName);
});

var CommitLineDiff = function(args) {
  this.added = ko.observable(args.fileLineDiff[0]);
  this.removed = ko.observable(args.fileLineDiff[1]);
  this.fileName = ko.observable(args.fileLineDiff[2]);
  this.showSpecificDiff = ko.observable(false);
  this.specificDiff = ko.observable(components.create(getFileType(this.fileName()), {
      filename: this.fileName(),
      repoPath: args.repoPath,
      server: args.server,
      sha1: args.sha1,
      initialDisplayLineLimit: 50     //Image diff doesn't use this so it doesn't matter.
    }));
};
exports.CommitLineDiff = CommitLineDiff;

CommitLineDiff.prototype.fileNameClick = function(data, event) {
  if (this.showSpecificDiff()) {
    this.showSpecificDiff(false);
  } else {
    var self = this;
    this.specificDiff().invalidateDiff(function() {
      self.showSpecificDiff(true);
    });
  }
  event.stopImmediatePropagation();
};

var getFileType = function(fileName) {
  if (!fileName) {
    return 'textdiff';
  }
  return fileType(fileName) + 'diff';
};
