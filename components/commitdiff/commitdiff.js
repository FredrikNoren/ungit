var ko = require('knockout');
var CommitLineDiff = require('./commitlinediff.js').CommitLineDiff;
var components = require('ungit-components');

components.register('commitDiff', function(args) {
  return new CommitDiff(args);
});

var CommitDiff = function(args) {
  this.totalLineDiffs = ko.observable();
  this.commitLineDiffs = ko.observable([]);

  var totalLineDiffs = args.fileLineDiffs.shift();
  if (!totalLineDiffs) {
    this.totalLineDiffs([0, 0, 'total']);
  } else {
    this.totalLineDiffs(totalLineDiffs);
  }

  var tempCommitLineDiffs = [];
  args.fileLineDiffs.forEach(function(fileLineDiff) {
    args.fileLineDiff = fileLineDiff;
    tempCommitLineDiffs.push(new CommitLineDiff(args));
  });
  this.commitLineDiffs(tempCommitLineDiffs);
};

CommitDiff.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('commitdiff', this, {}, parentElement);
};