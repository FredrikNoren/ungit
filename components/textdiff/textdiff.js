
var ko = require('knockout');
var components = require('ungit-components');
var diff2html = require('diff2html');

components.register('textdiff', function(args) {
  return new TextDiffViewModel(args);
});

var TextDiffViewModel = function(args) {
  var self = this;
  this.filename = args.filename;
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.diffs = ko.observable();
  this.sha1 = args.sha1;
  this.initialDisplayLineLimit = args.initialDisplayLineLimit ? args.initialDisplayLineLimit : 100;
}
TextDiffViewModel.prototype.updateNode = function(parentElement) {
  this.parentElement = parentElement;
}
TextDiffViewModel.prototype.loadAllLines = function(data, event) {
  event.stopImmediatePropagation();
  this.isLoadingAllLines(true);
  this.invalidateDiff();
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
      var html = diff2html.getPrettyHtmlFromDiff(diffs);

      if (html.length === 33) {
        var index = html.indexOf('\n');
        html = [html.slice(0, index), '&nbsp;Deleted...', html.slice(index)].join('\n');
      }

      self.parentElement.innerHTML = html;
    }

    if (callback) callback();
  });
}
