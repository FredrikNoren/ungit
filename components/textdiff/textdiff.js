const ko = require('knockout');
const components = require('ungit-components');
const diff2html = require('diff2html');
const sideBySideDiff = 'sidebysidediff';
const textDiff = 'textdiff';

components.register('textdiff', (args) => new TextDiffViewModel(args));
components.register('textdiff.type', () => new Type());
components.register('textdiff.wordwrap', () => new WordWrap());
components.register('textdiff.whitespace', () => new WhiteSpace());

const loadLimit = 100;

class WordWrap {
  constructor() {
    this.value = ko.observable(false);

    this.toggle = () => {
      this.value(!this.value());
    };
    this.text = ko.computed(() => (this.value() ? 'Wrap Lines' : 'No Wrap'));
    this.isActive = ko.computed(() => this.value());
  }
}

class Type {
  constructor() {
    if (
      !!ungit.config.diffType &&
      ungit.config.diffType !== textDiff &&
      ungit.config.diffType !== sideBySideDiff
    ) {
      ungit.config.diffType = textDiff;
      console.log('Config "diffType" must be either "textdiff" or "sidebysidediff".');
    }

    this.value = ko.observable(ungit.config.diffType || textDiff);

    this.toggle = () => {
      this.value(this.value() === textDiff ? sideBySideDiff : textDiff);
    };
    this.text = ko.computed(() => (this.value() === textDiff ? 'Inline' : 'Side By Side'));
    this.isActive = ko.computed(() => this.value() === sideBySideDiff);
  }
}

class WhiteSpace {
  constructor() {
    this.value = ko.observable(ungit.config.ignoreWhiteSpaceDiff);

    this.toggle = () => {
      this.value(!this.value());
    };
    this.text = ko.computed(() => (this.value() ? 'Show Whitespace' : 'Hide Whitespace'));
    this.isActive = ko.computed(() => this.value());
  }
}

class TextDiffViewModel {
  constructor(args) {
    this.filename = args.filename;
    this.oldFilename = args.oldFilename;
    this.repoPath = args.repoPath;
    this.server = args.server;
    this.sha1 = args.sha1;
    this.hasMore = ko.observable(false);
    this.diffJson = null;
    this.loadCount = loadLimit;
    this.textDiffType = args.textDiffType;
    this.whiteSpace = args.whiteSpace;
    this.isShowingDiffs = args.isShowingDiffs;
    this.editState = args.editState;
    this.wordWrap = args.wordWrap;
    this.patchLineList = args.patchLineList;
    this.numberOfSelectedPatchLines = 0;
    this.htmlSrc = undefined;
    this.isParsed = ko.observable(false);

    this.isShowingDiffs.subscribe((newValue) => {
      if (newValue) this.render();
    });
    this.textDiffType.value.subscribe(() => {
      if (this.isShowingDiffs()) this.render();
    });
    this.whiteSpace.value.subscribe(() => {
      if (this.isShowingDiffs()) this.invalidateDiff();
    });

    if (this.isShowingDiffs()) {
      this.render();
    }
  }

  updateNode(parentElement) {
    ko.renderTemplate('textdiff', this, {}, parentElement);
  }

  getDiffArguments() {
    return {
      file: this.filename,
      oldFile: this.oldFilename,
      path: this.repoPath(),
      sha1: this.sha1 ? this.sha1 : '',
      whiteSpace: this.whiteSpace.value(),
    };
  }

  invalidateDiff() {
    this.diffJson = null;
    if (this.isShowingDiffs()) this.render();
  }

  getDiffJson() {
    return this.server
      .getPromise('/diff', this.getDiffArguments())
      .then((diffs) => {
        if (typeof diffs !== 'string') {
          // Invalid value means there is no changes, show dummy diff without any changes
          diffs = `diff --git a/${this.filename} b/${this.filename}
                  index aaaaaaaa..bbbbbbbb 111111
                  --- a/${this.filename}
                  +++ b/${this.filename}`;
        }
        this.diffJson = diff2html.parse(diffs);
      })
      .catch((err) => {
        // The file existed before but has been removed, but we're trying to get a diff for it
        // Most likely it will just disappear with the next refresh of the staging area
        // so we just ignore the error here
        if (err.errorCode != 'no-such-file') {
          this.server.unhandledRejection(err);
        } else {
          ungit.logger.warn('diff, no such file', err);
        }
      });
  }

  render() {
    return (!this.diffJson ? this.getDiffJson() : Promise.resolve()).then(() => {
      if (!this.diffJson || this.diffJson.length == 0) return; // check if diffs are available (binary files do not support them)

      if (!this.diffJson[0].allBlocks) {
        this.diffJson[0].allBlocks = this.diffJson[0].blocks;
      }

      const currentLoadCount = Math.max(this.loadCount, loadLimit);
      let lineCount = 0;
      let loadCount = 0;
      this.diffJson[0].blocks = this.diffJson[0].allBlocks.reduce((blocks, block) => {
        const length = block.lines.length;
        const remaining = currentLoadCount - lineCount;
        if (remaining > 0) {
          loadCount += length;
          blocks.push(block);
        }
        lineCount += length;
        return blocks;
      }, []);

      this.loadCount = loadCount;
      this.hasMore(lineCount > loadCount);

      let html = diff2html.html(this.diffJson, {
        outputFormat:
          this.textDiffType.value() === sideBySideDiff ? 'side-by-side' : 'line-by-line',
        drawFileList: false,
      });

      this.numberOfSelectedPatchLines = 0;
      let index = 0;

      // ko's binding resolution is not recursive, which means below ko.bind refresh method doesn't work for
      // data bind at getPatchCheckBox that is rendered with "html" binding.
      // which is reason why manually updating the html content and refreshing kobinding to have it render...
      if (this.patchLineList) {
        html = html.replace(/<span class="d2h-code-line-prefix">(\+|-)/g, (match, capture) => {
          if (this.patchLineList()[index] === undefined) {
            this.patchLineList()[index] = true;
          }

          return this.getPatchCheckBox(capture, index, this.patchLineList()[index++]);
        });
      }

      if (html !== this.htmlSrc) {
        // diff has changed since last we displayed and need refresh
        this.htmlSrc = html;
        this.isParsed(false);
        this.isParsed(true);
      }
    });
  }

  loadMore() {
    this.loadCount += loadLimit;
    this.render();
  }

  getPatchCheckBox(symbol, index, isActive) {
    if (isActive) {
      this.numberOfSelectedPatchLines++;
    }
    return `<span class="d2h-code-line-prefix"><span data-bind="visible: editState() !== 'patched'">${symbol}</span><input ${
      isActive ? 'checked' : ''
    } type="checkbox" data-bind="visible: editState() === 'patched', click: togglePatchLine.bind($data, ${index})">`;
  }

  togglePatchLine(index) {
    this.patchLineList()[index] = !this.patchLineList()[index];

    if (this.patchLineList()[index]) {
      this.numberOfSelectedPatchLines++;
    } else {
      this.numberOfSelectedPatchLines--;
    }

    if (this.numberOfSelectedPatchLines === 0) {
      this.editState('none');
    }

    return true;
  }
}
