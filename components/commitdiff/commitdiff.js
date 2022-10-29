const ko = require('knockout');
const CommitLineDiff = require('./commitlinediff.js').CommitLineDiff;
const components = require('ungit-components');

components.register('commitDiff', (args) => new CommitDiff(args));

class CommitDiff {
  constructor(args) {
    this.sha1 = args.sha1;

    this.showDiffButtons = args.showDiffButtons;
    this.textDiffType = args.textDiffType = args.textDiffType || components.create('textdiff.type');
    this.wordWrap = args.wordWrap = args.wordWrap || components.create('textdiff.wordwrap');
    this.whiteSpace = args.whiteSpace = args.whiteSpace || components.create('textdiff.whitespace');

    this.commitLineDiffs = args.fileLineDiffs.map(
      (fileLineDiff) => new CommitLineDiff(args, fileLineDiff)
    );
  }

  updateNode(parentElement) {
    ko.renderTemplate('commitdiff', this, {}, parentElement);
  }
}
