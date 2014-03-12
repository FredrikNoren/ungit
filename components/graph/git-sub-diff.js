var ko = require('knockout');
var FileLineDiff = require('./git-file-line-diff.js').FileLineDiff;

var SubDiff = function(args) {
  this.totalLineDiffs = ko.observable();
  this.fileLineDiffs = ko.observable([]);

  var totalLineDiffs = args.fileLineDiffs.shift();
  if (!totalLineDiffs) {
    this.totalLineDiffs([0, 0, 'total']);
  } else {
    this.totalLineDiffs(totalLineDiffs);
  }

  var tempFileLineDiffs = [];
  args.fileLineDiffs.forEach(function(fileLineDiff) {
    args.fileLineDiff = fileLineDiff;
    tempFileLineDiffs.push(new FileLineDiff(args));
  });
  this.fileLineDiffs(tempFileLineDiffs);
};
exports.SubDiff = SubDiff;
