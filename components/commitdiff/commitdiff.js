const ko = require('knockout');
const CommitLineDiff = require('./commitlinediff.js').CommitLineDiff;
const components = require('ungit-components');

components.register('commitDiff', (args) => new CommitDiff(args));

class CommitDiff {
  constructor(args) {
    this.commitLineDiffs = ko.observableArray();
    this.sha1 = args.sha1;

    this.showDiffButtons = args.showDiffButtons;
    this.textDiffType = args.textDiffType = args.textDiffType || components.create('textdiff.type');
    this.wordWrap = args.wordWrap = args.wordWrap || components.create('textdiff.wordwrap');
    this.whiteSpace = args.whiteSpace = args.whiteSpace || components.create('textdiff.whitespace');

    this.loadFileLineDiffs(args);
  }

  updateNode(parentElement) {
    ko.renderTemplate('commitdiff', this, {}, parentElement);
  }

  loadFileLineDiffs(args) {
    const tempCommitLineDiffs = [];
    const lineDiffLength = this.commitLineDiffs().length;

    args.fileLineDiffs
      .slice(lineDiffLength === 0 ? 0 : lineDiffLength + 1, this.maxNumberOfFilesShown)
      .forEach((fileLineDiff) => {
        tempCommitLineDiffs.push(new CommitLineDiff(args, fileLineDiff));
      });

    this.commitLineDiffs(this.commitLineDiffs().concat(tempCommitLineDiffs));
  }
}
