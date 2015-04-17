
var ko = require('knockout');
var components = require('ungit-components');
var diff2html = require('diff2html').Diff2Html;

components.register('textdiff', function(args) {
  return new TextDiffViewModel(args);
});

var TextDiffViewModel = function(args) {
  this.filename = args.filename;
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.sha1 = args.sha1;
  this.isMoreToLoad = ko.observable(false);
  this.diffJson = null;
  this.diffHtml = ko.observable();
  this.loadLimit = 100;
  this.diffType = ko.observable('textdiff');
}
TextDiffViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('textdiff', this, {}, parentElement);
}
TextDiffViewModel.prototype.getDiffArguments = function() {
  var args = {};
  args.file = this.filename;
  args.path = this.repoPath;
  args.sha1 = this.sha1 ? this.sha1 : '';
  args.isGetRaw = true;

  return args;
}

TextDiffViewModel.prototype.invalidateDiff = function(callback) {
  var self = this;

  self.server.get('/diff', this.getDiffArguments() , function(err, diffs) {
    if (typeof diffs === "string") {
      self.diffJson = diff2html.getJsonFromDiff(diffs);
      self.render();
    }

    if (callback) callback();
  });
}

TextDiffViewModel.prototype.render = function() {
  var diffJsonCopy = JSON.parse(JSON.stringify(this.diffJson));
  var diffLines = diffJsonCopy[0].blocks[0].lines;

  if (diffLines.length > this.loadLimit) {
    diffJsonCopy[0].blocks[0].lines = diffLines.slice(0, this.loadLimit);
    this.isMoreToLoad(true);
  } else {
    this.isMoreToLoad(false);
  }

  if (this.diffType() === 'sidebysidediff') {
    this.diffHtml(diff2html.getPrettySideBySideHtmlFromJson(diffJsonCopy));
  } else {
    this.diffHtml(diff2html.getPrettyHtmlFromJson(diffJsonCopy));
  }
};

TextDiffViewModel.prototype.loadMore = function(callback) {
  this.loadLimit += 100;
  this.render();
}
