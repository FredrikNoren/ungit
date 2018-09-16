
const ko = require('knockout');
const components = require('ungit-components');
const navigation = require('ungit-navigation');
const programEvents = require('ungit-program-events');
const md5 = require('blueimp-md5');
const moment = require('moment');

components.register('commit', args => new CommitViewModel(args));

class CommitViewModel {
  constructor(gitNode) {
    this.repoPath = gitNode.graph.repoPath;
    this.sha1 = gitNode.sha1;
    this.server = gitNode.graph.server;
    this.highlighted = gitNode.highlighted;
    this.nodeIsMousehover = gitNode.nodeIsMousehover;
    this.selected = gitNode.selected;
    this.pgpVerifiedString = gitNode.pgpVerifiedString;
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
    this.authorGravatar = ko.computed(() => md5((this.authorEmail() || "").trim().toLowerCase()));

    this.showCommitDiff = ko.computed(() => this.fileLineDiffs() && this.fileLineDiffs().length > 0);

    this.diffStyle = ko.computed(() => {
      const marginLeft = Math.min((gitNode.branchOrder() * 70), 450) * -1;
      if (this.selected() && this.element()) return { "margin-left": `${marginLeft}px`, width: `${window.innerWidth - 220}px` };
      else return {};
    });
  }

  updateNode(parentElement) {
    ko.renderTemplate('commit', this, {}, parentElement);
  }

  setData(args) {
    this.commitTime(moment(new Date(args.commitDate)));
    this.authorTime(moment(new Date(args.authorDate)));
    const message = args.message.split('\n');
    this.message(args.message);
    this.title(message[0]);
    this.body(message.slice((message[1] ? 1 : 2)).join('\n'));
    this.authorDate(moment(new Date(args.authorDate)));
    this.authorDateFromNow(this.authorDate().fromNow());
    this.authorName(args.authorName);
    this.authorEmail(args.authorEmail);
    this.numberOfAddedLines(args.fileLineDiffs.length > 0 ? args.fileLineDiffs[0][0] : 0);
    this.numberOfRemovedLines(args.fileLineDiffs.length > 0 ? args.fileLineDiffs[0][1] : 0);
    this.fileLineDiffs(args.fileLineDiffs);
    this.isInited = true;
    this.commitDiff = ko.observable(components.create('commitDiff', {
      fileLineDiffs: this.fileLineDiffs(),
      sha1: this.sha1,
      repoPath: this.repoPath,
      server: this.server
    }));
  }

  updateLastAuthorDateFromNow(deltaT) {
    this.lastUpdatedAuthorDateFromNow = this.lastUpdatedAuthorDateFromNow || 0;
    this.lastUpdatedAuthorDateFromNow += deltaT;
    if(this.lastUpdatedAuthorDateFromNow > 60 * 1000) {
      this.lastUpdatedAuthorDateFromNow = 0;
      this.authorDateFromNow(this.authorDate().fromNow());
    }
  }

  updateAnimationFrame(deltaT) {
    this.updateLastAuthorDateFromNow(deltaT);
  }

  stopClickPropagation(data, event) {
    event.stopImmediatePropagation();
  }
}
