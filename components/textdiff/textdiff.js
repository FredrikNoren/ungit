
const ko = require('knockout');
const components = require('ungit-components');
const diff2html = require('diff2html').Diff2Html;
const programEvents = require('ungit-program-events');
const promise = require("bluebird");
const sideBySideDiff = 'sidebysidediff';
const textDiff = 'textdiff';

components.register('textdiff', args => new TextDiffViewModel(args));
components.register('textdiff.type', () => new Type());
components.register('textdiff.wordwrap', () => new WordWrap());
components.register('textdiff.whitespace', () => new WhiteSpace());

const loadLimit = 100;

class WordWrap {
  constructor() {
    this.text = ko.observable("No Wrap");
    this.value = ko.observable(false);
    this.value.subscribe(value => { this.text(value ? "Word Wrap" : "No Wrap"); });
    this.toggle = () => { this.value(!this.value()); }
    this.isActive = ko.computed(() => !!this.value());
  }
}

class Type {
  constructor() {
    this.text = ko.observable("Default");

    if (!!ungit.config.diffType && ungit.config.diffType !== 'textdiff' && ungit.config.diffType !== 'sidebysidediff') {
      ungit.config.diffType = 'textdiff';
      console.log('Config "diffType" must be either "textdiff" or "sidebysidediff".');
    }

    this.value = ko.observable(ungit.config.diffType || textDiff);
    this.value.subscribe(value => {
      this.text(value === textDiff ? "Default" : "Side By Side");
      programEvents.dispatch({ event: 'invalidate-diff-and-render' });
    });
    this.toggle = () => {
      this.value(this.value() === textDiff ? sideBySideDiff : textDiff);
    }
    this.isActive = ko.computed(() => this.value() === 'textdiff');
  }
}

class WhiteSpace {
  constructor() {
    this.text = ko.observable("Show/Ignore white space diff");
    this.value = ko.observable(ungit.config.ignoreWhiteSpaceDiff);
    this.value.subscribe(value => {
      this.text(value ? "Ignoring White Space diff" : "Showing White Space diff");
      programEvents.dispatch({ event: 'invalidate-diff-and-render' });
    });
    this.toggle = () => { this.value(!this.value()); }
    this.isActive = ko.computed(() => !this.value());
  }
}

class TextDiffViewModel {
  constructor(args) {
    this.filename = args.filename;
    this.repoPath = args.repoPath;
    this.server = args.server;
    this.sha1 = args.sha1;
    this.loadMoreCount = ko.observable(0);
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

    programEvents.add(event => {
      if (event.event === "invalidate-diff-and-render" || event.event === "working-tree-changed") {
        this.invalidateDiff();
        if (this.isShowingDiffs()) this.render();
      }
    });

    this.isShowingDiffs.subscribe(newValue => {
      if (newValue) this.render();
    });

    if (this.isShowingDiffs()) { this.render(); }
  }

  updateNode(parentElement) {
    ko.renderTemplate('textdiff', this, {}, parentElement);
  }

  getDiffArguments() {
    return {
      file: this.filename,
      path: this.repoPath(),
      sha1: this.sha1 ? this.sha1 : '',
      whiteSpace: this.whiteSpace.value()
    };
  }

  invalidateDiff() {
    this.diffJson = null;
  }

  getDiffJson() {
    return this.server.getPromise('/diff', this.getDiffArguments()).then((diffs) => {
      if (typeof diffs !== 'string') {
        // Invalid value means there is no changes, show dummy diff withotu any changes
        diffs = `diff --git a/${this.filename} b/${this.filename}
                  index aaaaaaaa..bbbbbbbb 111111
                  --- a/${this.filename}
                  +++ b/${this.filename}`;
      }
      this.diffJson = diff2html.getJsonFromDiff(diffs);
    }).catch(err => {
      // The file existed before but has been removed, but we're trying to get a diff for it
      // Most likely it will just disappear with the next refresh of the staging area
      // so we just ignore the error here
      if (err.errorCode != 'no-such-file') this.server.unhandledRejection(err);
    });
  }

  render(isInvalidate) {
    return promise.resolve().then(() => {
      if (!this.diffJson || isInvalidate) {
        return this.getDiffJson();
      }
    }).then(() => {
      if (!this.diffJson || this.diffJson.length == 0) return; // check if diffs are available (binary files do not support them)
      let lineCount = 0;

      if (!this.diffJson[0].isTrimmed) {
        this.diffJson[0].blocks = this.diffJson[0].blocks.reduce((blocks, block) => {
          const length = block.lines.length;
          if (lineCount < this.loadCount) {
            block.lines = block.lines.slice(0, this.loadCount - lineCount);
            blocks.push(block);
          }
          lineCount += length;
          return blocks;
        }, []);
      }
      this.diffJson[0].isTrimmed = true;

      this.loadMoreCount(Math.min(loadLimit, Math.max(0, lineCount - this.loadCount)));

      let html;

      if (this.textDiffType.value() === 'sidebysidediff') {
        html = diff2html.getPrettySideBySideHtmlFromJson(this.diffJson);
      } else {
        html = diff2html.getPrettyHtmlFromJson(this.diffJson);
      }

      this.numberOfSelectedPatchLines = 0;
      let index = 0;

      // ko's binding resolution is not recursive, which means below ko.bind refresh method doesn't work for
      // data bind at getPatchCheckBox that is rendered with "html" binding.
      // which is reason why manually updating the html content and refreshing kobinding to have it render...
      if (this.patchLineList) {
        html = html.replace(/<span class="d2h-code-line-[a-z]+">(\+|\-)/g, (match, capture) => {
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
    this.loadCount += this.loadMoreCount();
    programEvents.dispatch({ event: 'invalidate-diff-and-render' });
  }

  getPatchCheckBox(symbol, index, isActive) {
    if (isActive) {
      this.numberOfSelectedPatchLines++;
    }
    return `<div class="d2h-code-line-prefix"><span data-bind="visible: editState() !== 'patched'">${symbol}</span><input ${isActive ? 'checked' : ''} type="checkbox" data-bind="visible: editState() === 'patched', click: togglePatchLine.bind($data, ${index})"></input>`;
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
