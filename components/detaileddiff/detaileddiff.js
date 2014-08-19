var ko = require('knockout');
var components = require('ungit-components');
var DialogViewModel = require('../dialogs/dialogs.js').DialogViewModel;
var inherits = require('util').inherits;

components.register('detaileddiff', function(args) {
  return new DetailedDiff(args.repoPath, args.server, args.sha1Right, args.sha1Left);
});

var DetailedDiff = function(repoPath, server, sha1Right, sha1Left) {
  DialogViewModel.call(this, 'Detailed Diff');
  this.repoPath = repoPath;
  this.server = server;
  this.sha1Right = ko.observable(sha1Right);

  // If left is not defined, assume immediately previous sha1
  if (sha1Left) {
    this.sha1Left = ko.observable(sha1Left);
  } else {
    this.sha1Left = ko.observable(sha1Right + "~1");
  }
}
inherits(DetailedDiff, DialogViewModel);
DetailedDiff.prototype.template = 'detailedDiff';
