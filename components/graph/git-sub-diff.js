var ko = require('knockout');
var FileLineDiff = require('./git-file-line-diff.js').FileLineDiff;

var SubDiff = function(fileLineDiffs) {
  this.totalLineDiffs = ko.observable();
  this.fileLineDiffs = ko.observable([]);

  var totalLineDiffs = fileLineDiffs.shift();
  if (!totalLineDiffs) {
    this.totalLineDiffs([0, 0, 'total']);
  } else {
    this.totalLineDiffs(totalLineDiffs);
  }

  var tempFileLineDiffs = [];
  for (var counter in fileLineDiffs){
    tempFileLineDiffs.push(new FileLineDiff(fileLineDiffs[counter]));
  }
  this.fileLineDiffs(tempFileLineDiffs);
};
exports.SubDiff = SubDiff;
