var ko = require('knockout');
var SubLineDiff = require('./git-sub-line-diff.js').SubLineDiff;

var SubDiff = function(args) {
  this.totalLineDiffs = ko.observable();
  this.subLineDiffs = ko.observable([]);

  var totalLineDiffs = args.fileLineDiffs.shift();
  if (!totalLineDiffs) {
    this.totalLineDiffs([0, 0, 'total']);
  } else {
    this.totalLineDiffs(totalLineDiffs);
  }

  var tempSubLineDiffs = [];
  args.fileLineDiffs.forEach(function(fileLineDiff) {
    args.fileLineDiff = fileLineDiff;
    tempSubLineDiffs.push(new SubLineDiff(args));
  });
  this.subLineDiffs(tempSubLineDiffs);
};
exports.SubDiff = SubDiff;
