var ko = require('knockout');
var CommitLineDiff = require('./commitlinediff.js').CommitLineDiff;
var components = require('ungit-components');

var sideBySideDiff = 'sidebysidediff'
var textDiff = 'textdiff'

components.register('commitDiff', function(args) {
  return new CommitDiff(args);
});

var CommitDiff = function(args) {
  var self = this;
  this.commitLineDiffs = ko.observableArray();
  this.sha1 = args.sha1;

  // parent components can provide their own buttons (e.g. staging component)
  this.showDiffButtons = ko.observable(!args.textDiffType);
  this.textDiffTypeTitle = ko.observable("Default");
  this.textDiffType = args.textDiffType = args.textDiffType || ko.observable('textdiff');
  this.textDiffType.subscribe(function(value) {
    self.textDiffTypeTitle(value === textDiff ? "Default" : "Side By Side");
  });
  this.wordWrapTitle = ko.observable("No Word Wrap");
  this.wordWrap = args.wordWrap = args.wordWrap || ko.observable(false);
  this.wordWrap.subscribe(function(value) {
    self.wordWrapTitle(value ? "Word Wrap" : "No Word Wrap");
  });

  args.fileLineDiffs.shift();  // remove first line that has "total"
  this.loadFileLineDiffs(args);
};

CommitDiff.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('commitdiff', this, {}, parentElement);
};

CommitDiff.prototype.loadFileLineDiffs = function(args) {
  var tempCommitLineDiffs = [];
  var lineDiffLength = this.commitLineDiffs().length;

  args.fileLineDiffs.slice(lineDiffLength === 0 ? 0 : lineDiffLength + 1, this.maxNumberOfFilesShown).forEach(function(fileLineDiff) {
    tempCommitLineDiffs.push(new CommitLineDiff(args, fileLineDiff));
  });

  this.commitLineDiffs(this.commitLineDiffs().concat(tempCommitLineDiffs));
}
CommitDiff.prototype.textDiffTypeToggle = function(type) {
  this.textDiffType(this.textDiffType() === textDiff ? sideBySideDiff : textDiff);
}
CommitDiff.prototype.wordWrapToggle = function(state) {
  this.wordWrap(!this.wordWrap());
}
