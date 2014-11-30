
var ko = require('knockout');
var components = require('ungit-components');
var Diff2Html = require('../../node_modules/diff2html/src/diff2html.js');

components.register('sidebysidediff', function(args) {
  return new SideBySideDiffViewModel(args);
});

var SideBySideDiffViewModel = function(args) {
  this.filename = args.filename;
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.diffs = ko.observable();
  this.sha1 = args.sha1;
  this.parentElement = null;
}

SideBySideDiffViewModel.prototype.updateNode = function(parentElement) {
  this.parentElement = parentElement;
}

SideBySideDiffViewModel.prototype.getDiffArguments = function() {
  var args = {};

  args.file = this.filename;
  args.path = this.repoPath;
  args.sha1 = this.sha1 ? this.sha1 : '';
  args.isGetRaw = true;

  return args;
}

SideBySideDiffViewModel.prototype.invalidateDiff = function(callback) {
  var self = this;

  self.server.get('/diff', this.getDiffArguments() , function(err, diffs) {
    var diffJson = Diff2Html.getJsonFromDiff(diffs);
    self.parentElement.innerHTML = Diff2Html.getPrettySideBySideHtmlFromJson(diffJson;

    if (callback) callback();
  });
}
