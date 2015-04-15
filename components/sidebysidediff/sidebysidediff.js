
var ko = require('knockout');
var components = require('ungit-components');
var diff2html = require('diff2html').Diff2Html;

components.register('sidebysidediff', function(args) {
  return new SideBySideDiffViewModel(args);
});

var SideBySideDiffViewModel = function(args) {
  this.filename = args.filename;
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.sha1 = args.sha1;
  this.isMoreToLoad = ko.observable(false);
  this.diffJson = null;
  this.diffHtml = ko.observable();
  this.loadLimit = 100;
}

SideBySideDiffViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('sidebysidediff', this, {}, parentElement);
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
    if (typeof diffs === "string") {
      self.diffJson = diff2html.getJsonFromDiff(diffs);
      self.render();
    }

    if (callback) callback();
  });
}

SideBySideDiffViewModel.prototype.render = function() {
  var diffJsonCopy = JSON.parse(JSON.stringify(this.diffJson));
  var diffLines = diffJsonCopy[0].blocks[0].lines;

  if (diffLines.length > this.loadLimit) {
    diffJsonCopy[0].blocks[0].lines = diffLines.slice(0, this.loadLimit);
    this.isMoreToLoad(true);
  } else {
    this.isMoreToLoad(false);
  }
  this.diffHtml(diff2html.getPrettySideBySideHtmlFromJson(diffJsonCopy));
};

SideBySideDiffViewModel.prototype.loadMore = function(callback) {
  this.loadLimit += 100;
  this.render();
}
