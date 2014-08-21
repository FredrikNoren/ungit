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
  this.files = ko.observable();

  // If left is not defined, assume compare against immediately previous sha1
  if (sha1Left) {
    this.sha1Left = ko.observable(sha1Left);
  } else {
    this.sha1Left = ko.observable(sha1Right + "~1");
  }

  var self = this;

  // get fileNames
  this.server.get('/show', { path: this.repoPath, sha1: this.sha1Right() }, function(err, logEntries) {
    if (err || !logEntries || !logEntries[0] || logEntries[0].fileLineDiffs.length === 0) {
      return;
    }

    var files = [];
    // ignoring first item as it is contains total line diff info
    for(var n = 1; n < logEntries[0].fileLineDiffs.length; n++) {
      files.push(components.create('fileViewModel', { server: self.server,
                                                      repoPath: self.repoPath,
                                                      name: logEntries[0].fileLineDiffs[n][2],
                                                      type: 'textdiff',
                                                      sha1: self.sha1Right() }
      ));
    }

    self.files(files);
  });
}
inherits(DetailedDiff, DialogViewModel);
DetailedDiff.prototype.template = 'detailedDiff';
