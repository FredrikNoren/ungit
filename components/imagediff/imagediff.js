
var ko = require('knockout');
var components = require('ungit-components');

components.register('imagediff', function(args) {
  return new ImageDiffViewModel(args);
});

var ImageDiffViewModel = function(args) {
  var self = this;
  this.filename = args.filename;
  this.repoPath = args.repoPath;
  this.state = ko.computed(function() {
    if (fileViewModel.isNew()) return 'new';
    if (fileViewModel.removed()) return 'removed';
    return 'changed';
  });
  this.oldImageSrc = ko.computed(function() {
    return '/api/diff/image?path=' + encodeURIComponent(self.repoPath) + '&filename=' + self.filename + '&version=previous';
  });
  this.newImageSrc = ko.computed(function() {
    return '/api/diff/image?path=' + encodeURIComponent(self.repoPath) + '&filename=' + self.filename + '&version=current';
  });
}
ImageDiffViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('imagediff', this, {}, parentElement);
}
ImageDiffViewModel.prototype.invalidateDiff = function(callback) {
  callback();
}

