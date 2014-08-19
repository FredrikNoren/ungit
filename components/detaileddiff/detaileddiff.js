var ko = require('knockout');
var components = require('ungit-components');
var DialogViewModel = require('../dialogs/dialogs.js').DialogViewModel;
var inherits = require('util').inherits;

components.register('detaileddiff', function(args) {
  return new DetailedDiff(args.repoPath, args.server, args.sha1);
});

var DetailedDiff = function(repoPath, server, sha1) {
  DialogViewModel.call(this, 'Detailed Diff');
  this.repoPath = repoPath;
  this.server = server;
  this.sha1 = ko.observable(sha1);
}
inherits(DetailedDiff, DialogViewModel);
DetailedDiff.prototype.template = 'detailedDiff';
