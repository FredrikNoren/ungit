var ko = require('knockout');
var components = require('ungit-components');
var inherits = require('util').inherits;
var TextDiffViewModel = require('../textdiff/textdiff.js').TextDiffViewModel;

var imageFileExtensions = ['.PNG', '.JPG', '.BMP', '.GIF'];

var FileLineDiff = function(args) {
  this.added = ko.observable(args.fileLineDiff[0]);
  this.removed = ko.observable(args.fileLineDiff[1]);
  this.fileName = ko.observable(args.fileLineDiff[2]);
  this.path = args.path;
  this.server = args.server;
  this.sha1 = args.sha1;
  this.showSpecificDiff = ko.observable(false);
  this.specificDiff = ko.observable(components.create(this.type() == 'image' ? 'imagediff' : 'textdiff', {
      filename: this.fileName(),
      repoPath: this.path,
      server: this.server,
      sha1: this.sha1
    }));
};
exports.FileLineDiff = FileLineDiff;

FileLineDiff.prototype.fileNameClick = function(data, event) {
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

FileLineDiff.prototype.type = function() {

  if (!this.fileName()) {
    console.log(this.fileName());
    return 'text';
  }
  var splited = this.fileName().split('.');
  var ext = splited[splited.length - 1];
  return imageFileExtensions.indexOf(ext.toUpperCase()) != -1 ? 'image' : 'text';
};