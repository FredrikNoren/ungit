
var ko = require('knockout');
var components = require('ungit-components');
var Promise = require('bluebird');

components.register('imagediff', function(args) {
  return new ImageDiffViewModel(args);
});

var ImageDiffViewModel = function(args) {
  var self = this;
  this.filename = args.filename;
  this.repoPath = args.repoPath;
  this.isNew = ko.observable(false);
  this.isRemoved = ko.observable(false);
  this.sha1 = args.sha1;
  this.state = ko.computed(function() {
    if (self.isNew()) return 'new';
    if (self.isRemoved()) return 'removed';
    return 'changed';
  });
  var gitDiffURL = ungit.config.rootPath + '/api/diff/image?path=' + encodeURIComponent(self.repoPath()) + '&filename=' + self.filename + '&version=';
  this.oldImageSrc = gitDiffURL + (self.sha1 ? self.sha1 + '^': 'HEAD');
  this.newImageSrc = gitDiffURL + (self.sha1 ? self.sha1: 'current');
  this.isShowingDiffs = args.isShowingDiffs;
}
ImageDiffViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('imagediff', this, {}, parentElement);
}
ImageDiffViewModel.prototype.invalidateDiff = function() {}
ImageDiffViewModel.prototype.newImageError = function() {
  this.isRemoved(true);
}
ImageDiffViewModel.prototype.oldImageError = function() {
  this.isNew(true);
}
