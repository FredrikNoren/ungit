const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');

class CommitLineDiff {
  constructor(args, /** @type {DiffStat} */ data) {
    this.added = ko.observable(data.additions);
    this.removed = ko.observable(data.deletions);

    // TODO remove
    this.fileName = ko.observable(data.fileName);
    this.oldFileName = ko.observable(data.oldFileName);
    this.sha1 = args.sha1;

    this.diffKey = args.diffKey;
    const { fileName, oldFileName, idx } = data;
    this.idx = idx;

    this.isNew = !oldFileName;
    this.wasRemoved = !fileName;
    this.hasConflict = data.hasConflict;
    this.renamed = data.oldFileName && data.fileName && data.oldFileName !== data.fileName;

    this.displayName = ko.observable(
      fileName
        ? oldFileName
          ? oldFileName !== fileName
            ? `${oldFileName} → ${fileName}`
            : fileName
          : `[new] ${fileName}`
        : `[del] ${oldFileName}`
    );
    this.fileType = data.type;

    this.isShowingDiffs = ko.observable(false);
    this.repoPath = args.repoPath;
    this.server = args.server;
    this.textDiffType = args.textDiffType;
    this.wordWrap = args.wordWrap;
    this.whiteSpace = args.whiteSpace;
    this.specificDiff = ko.observable(this.getSpecificDiff());
  }

  getSpecificDiff() {
    return components.create(`${this.fileType}diff`, {
      filename: this.fileName(),
      oldFilename: this.oldFileName(),
      repoPath: this.repoPath,
      server: this.server,

      diffKey: this.diffKey,
      idx: this.idx,
      textDiffType: this.textDiffType,
      isShowingDiffs: this.isShowingDiffs,
      whiteSpace: this.whiteSpace,
      wordWrap: this.wordWrap,

      isNew: this.isNew,
      removed: this.wasRemoved,
      conflict: this.hasConflict,
    });
  }

  fileNameClick() {
    this.isShowingDiffs(!this.isShowingDiffs());
    programEvents.dispatch({ event: 'graph-render' });
  }
}

exports.CommitLineDiff = CommitLineDiff;
