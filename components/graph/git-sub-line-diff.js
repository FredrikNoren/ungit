var ko = require('knockout');
var components = require('ungit-components');
var inherits = require('util').inherits;
var TextDiffViewModel = require('../textdiff/textdiff.js').TextDiffViewModel;

var imageFileExtensions = ['.PNG', '.JPG', '.BMP', '.GIF'];

var SubLineDiff = function(args) {
  this.added = ko.observable(args.fileLineDiff[0]);
  this.removed = ko.observable(args.fileLineDiff[1]);
  this.fileName = ko.observable(args.fileLineDiff[2]);
  this.showSpecificDiff = ko.observable(false);
  this.specificDiff = ko.observable(components.create(this.type(), {
      filename: this.fileName(),
      repoPath: args.path,
      server: args.server,
      sha1: args.sha1
    }));
};
exports.SubLineDiff = SubLineDiff;

SubLineDiff.prototype.fileNameClick = function(data, event) {
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

SubLineDiff.prototype.type = function() {
  if (!this.fileName()) {
    console.log(this.fileName());
    return 'textdiff';
  }
  var splited = this.fileName().split('.');
  var ext = splited[splited.length - 1];
  return imageFileExtensions.indexOf(ext.toUpperCase()) != -1 ? 'imagediff' : 'textdiff';
};