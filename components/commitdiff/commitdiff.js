var ko = require('knockout');
var CommitLineDiff = require('./commitlinediff.js').CommitLineDiff;
var components = require('ungit-components');

components.register('commitDiff', function(args) {
  return new CommitDiff(args);
});

var CommitDiff = function(args) {
  this.commitLineDiffs = ko.observableArray();
  this.sha1 = args.sha1;

  // parent components can provide their own buttons (e.g. staging component)
  this.showDiffButtons = ko.observable(!args.textDiffType);
  this.textDiffType = args.textDiffType = args.textDiffType || components.create('textdiff.type');
  this.wordWrap = args.wordWrap = args.wordWrap || components.create('textdiff.wordwrap');
  this.whiteSpace = args.whiteSpace = args.whiteSpace || components.create('textdiff.whitespace');

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
