var ko = require('knockout');
var components = require('ungit-components');
var inherits = require('util').inherits;
var programEvents = require('ungit-program-events');

var imageFileExtensions = ['PNG', 'JPG', 'BMP', 'GIF', 'JPEG'];

var CommitLineDiff = function(args) {
  this.added = ko.observable(args.fileLineDiff[0]);
  this.removed = ko.observable(args.fileLineDiff[1]);
  this.fileName = ko.observable(args.fileLineDiff[2]);
  this.showSpecificDiff = ko.observable(false);
  this.specificDiff = ko.observable(components.create(this.type(), {
      filename: this.fileName(),
      repoPath: args.repoPath,
      server: args.server,
      sha1: args.sha1
    }));
};
exports.CommitLineDiff = CommitLineDiff;

CommitLineDiff.prototype.fileNameClick = function(data, event) {
  var self = this;

  if (this.showSpecificDiff()) {
    this.showSpecificDiff(false);
  } else {
    if (this.added() + this.removed() < 100 || this.isLoaded()) {
      this.showDiff();
    } else {
      var checkPrompt = components.create('yesnodialog', { 'title': 'Are you sure?', 'details': 'Diff is too big, are you sure you want to see the diff?'});
      checkPrompt.closed.add(function() {
        if (checkPrompt.result()) {
          self.showDiff();
        }
      });
      programEvents.dispatch({ event: 'request-show-dialog', dialog: checkPrompt });
    }
  }
  
  event.stopImmediatePropagation();
};

CommitLineDiff.prototype.showDiff = function() {
  var self = this;
  if (!this.isLoaded()) {
    this.specificDiff().invalidateDiff(function() {
      self.showSpecificDiff(true);
    });      
  } else {
    self.showSpecificDiff(true);
  }
}

CommitLineDiff.prototype.isLoaded = function() {
  return this.type() === 'textdiff' && this.specificDiff().diffs();
}

CommitLineDiff.prototype.type = function() {
  if (!this.fileName()) {
    return 'textdiff';
  }
  var splited = this.fileName().split('.');
  var ext = splited[splited.length - 1];
  return imageFileExtensions.indexOf(ext.toUpperCase()) != -1 ? 'imagediff' : 'textdiff';
};