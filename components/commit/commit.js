
var ko = require('knockout');
var components = require('ungit-components');
var navigation = require('ungit-navigation');
var programEvents = require('ungit-program-events');
var md5 = require('blueimp-md5').md5;
var moment = require('moment');

components.register('commit', function(args) {
  return new CommitViewModel(args);
});

function CommitViewModel(args) {
  var self = this;
  this.repoPath = args.repoPath;
  this.sha1 = args.sha1;
  this.server = args.server;

  this.highlighted = ko.observable();
  this.nodeIsMousehover = ko.observable();
  this.selected = ko.observable();

  this.element = ko.observable();

  this.commitTime = ko.observable();
  this.authorTime = ko.observable();
  this.message = ko.observable();
  this.title = ko.observable();
  this.body = ko.observable();
  this.authorDate = ko.observable(0);
  this.authorDateFromNow = ko.observable();
  this.authorName = ko.observable();
  this.authorEmail = ko.observable();
  this.fileLineDiffs = ko.observable();
  this.numberOfAddedLines = ko.observable();
  this.numberOfRemovedLines = ko.observable();
  this.authorGravatar = ko.computed(function() { return md5(self.authorEmail()); });
  this.textDiffOptions = [ { name: 'Default Diff', component: 'textdiff' },
                           { name: 'Side-by-Side Diff', component: 'sidebysidediff' } ];
  this.textDiffTypeIndex = ko.observable(0);
  this.textDiffType = ko.computed(function() {
    return this.textDiffOptions[this.textDiffTypeIndex()];
  }, this);

  this.showCommitDiff = ko.computed(function() {
    return self.fileLineDiffs() && self.fileLineDiffs().length > 0;
  });

  this.selectedDiffLeftPosition = ko.observable();
  this.diffStyle = ko.computed(function() {
    if (self.selected()) return { left: self.selectedDiffLeftPosition() + 'px', width: (window.innerWidth - 120) + 'px' };
    else return { left: '0px', width: self.element() ? ((self.element().clientWidth - 20) + 'px') : 'inherit' };
  });
}
CommitViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('commit', this, {}, parentElement);
}
CommitViewModel.prototype.setData = function(args) {
  this.commitTime(moment(new Date(args.commitDate)));
  this.authorTime(moment(new Date(args.authorDate)));
  var message = args.message.split('\n');
  this.message(args.message);
  this.title(message[0]);
  this.body(message.slice(2).join('\n'));
  this.authorDate(moment(new Date(args.authorDate)));
  this.authorDateFromNow(this.authorDate().fromNow());
  this.authorName(args.authorName);
  this.authorEmail(args.authorEmail);
  this.numberOfAddedLines(args.fileLineDiffs.length > 0 ? args.fileLineDiffs[0][0] : 0);
  this.numberOfRemovedLines(args.fileLineDiffs.length > 0 ? args.fileLineDiffs[0][1] : 0);
  this.fileLineDiffs(args.fileLineDiffs);
  this.isInited = true;
  this.commitDiff = ko.observable(components.create('commitDiff',
    { fileLineDiffs: this.fileLineDiffs().slice(),
      sha1: this.sha1,
      repoPath: this.repoPath,
      server: this.server,
      textDiffType: this.textDiffType }));
}
CommitViewModel.prototype.updateLastAuthorDateFromNow = function(deltaT) {
  this.lastUpdatedAuthorDateFromNow = this.lastUpdatedAuthorDateFromNow || 0;
  this.lastUpdatedAuthorDateFromNow += deltaT;
  if(this.lastUpdatedAuthorDateFromNow > 60 * 1000) {
    this.lastUpdatedAuthorDateFromNow = 0;
    this.authorDateFromNow(this.authorDate().fromNow());
  }
}
CommitViewModel.prototype.updateAnimationFrame = function(deltaT) {
  this.updateLastAuthorDateFromNow(deltaT);
}
CommitViewModel.prototype.showSideBySideDiff = function() {
  this.textDiffTypeIndex(1);
}
CommitViewModel.prototype.showDefaultDiff = function() {
  this.textDiffTypeIndex(0);
}
CommitViewModel.prototype.stopClickPropagation = function(data, event) {
  event.stopImmediatePropagation();
}
