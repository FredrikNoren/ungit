const ko = require('knockout');
const octicons = require('octicons');
const components = require('ungit-components');

components.register('imagediff', args => new ImageDiffViewModel(args));

class ImageDiffViewModel {
  constructor(args) {
    this.filename = args.filename;
    this.repoPath = args.repoPath;
    this.isNew = ko.observable(false);
    this.isRemoved = ko.observable(false);
    this.sha1 = args.sha1;
    this.state = ko.computed(() => {
      if (this.isNew()) return 'new';
      if (this.isRemoved()) return 'removed';
      return 'changed';
    });
    const gitDiffURL = `${ungit.config.rootPath}/api/diff/image?path=${encodeURIComponent(this.repoPath())}&filename=${this.filename}&version=`;
    this.oldImageSrc = gitDiffURL + (this.sha1 ? this.sha1 + '^' : 'HEAD');
    this.newImageSrc = gitDiffURL + (this.sha1 ? this.sha1 : 'current');
    this.isShowingDiffs = args.isShowingDiffs;
    this.rightArrowIcon = octicons['arrow-right'].toSVG({ 'height': 100 });
    this.downArrowIcon = octicons['arrow-down'].toSVG({ 'height': 100 });
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
