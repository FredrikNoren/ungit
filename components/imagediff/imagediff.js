const ko = require('knockout');
const octicons = require('octicons');
const components = require('ungit-components');
const { encodePath } = require('ungit-address-parser');

components.register('imagediff', (args) => new ImageDiffViewModel(args));

class ImageDiffViewModel {
  constructor(args) {
    this.filename = args.filename;
    this.oldFilename = args.oldFilename;
    this.repoPath = args.repoPath;
    this.isNew = ko.observable(args.filename && !args.oldFilename);
    this.isRemoved = ko.observable(args.oldFilename && !args.filename);
    // TODO indicator component
    this.state = ko.observable(
      args.isNew ? 'new' : args.removed ? 'removed' : args.conflict ? 'conflict' : 'changed'
    );
    const gitDiffURL = `${ungit.config.rootPath}/api/diff/image?path=${encodePath(
      this.repoPath()
    )}`;
    const [newSha1, oldSha1] = args.diffKey.split('.');
    this.oldImageSrc =
      oldSha1 === 'null'
        ? undefined
        : gitDiffURL + `&filename=${this.oldFilename}&version=${oldSha1}`;
    this.newImageSrc = gitDiffURL + `&filename=${this.filename}&version=${newSha1}`;
    this.isShowingDiffs = args.isShowingDiffs;
    this.rightArrowIcon = octicons['arrow-right'].toSVG({ height: 100 });
    this.downArrowIcon = octicons['arrow-down'].toSVG({ height: 100 });
  }

  updateNode(parentElement) {
    ko.renderTemplate('imagediff', this, {}, parentElement);
  }

  invalidateDiff() {}

  newImageError() {
    this.isRemoved(true);
  }

  oldImageError() {
    this.isNew(true);
  }
}
