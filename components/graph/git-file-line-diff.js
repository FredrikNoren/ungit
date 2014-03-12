var ko = require('knockout');

var FileLineDiff = function(fileLineDiff) {
  this.added = ko.observable(fileLineDiff[0]);
  this.removed = ko.observable(fileLineDiff[1]);
  this.fileName = ko.observable(fileLineDiff[2]);
};
exports.FileLineDiff = FileLineDiff;
