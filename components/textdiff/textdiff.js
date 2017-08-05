
var ko = require('knockout');
var components = require('ungit-components');
var diff2html = require('diff2html').Diff2Html;
var programEvents = require('ungit-program-events');
var Promise = require("bluebird");

components.register('textdiff', function (args) {
  return new TextDiffViewModel(args);
});

components.register('textdiff.type', function () {
  return new Type();
});

components.register('textdiff.wordwrap', function () {
  return new WordWrap();
});

components.register('textdiff.whitespace', function () {
  return new WhiteSpace();
});

var loadLimit = 100;

var WordWrap = function () {
  var self = this;

  this.text = ko.observable("No Wrap");
  this.value = ko.observable(false);
  this.value.subscribe(function (value) {
    self.text(value ? "Word Wrap" : "No Wrap");
  });
  this.toggle = function () {
    self.value(!self.value());
  }
  this.isActive = ko.computed(function () { return !!self.value(); });
}

var Type = function () {
  var self = this;
  var sideBySideDiff = 'sidebysidediff'
  var textDiff = 'textdiff'

  this.text = ko.observable("Default");

  if (!!ungit.config.diffType && ungit.config.diffType !== 'textdiff' && ungit.config.diffType !== 'sidebysidediff') {
    ungit.config.diffType = 'textdiff';
    console.log('Config "diffType" must be either "textdiff" or "sidebysidediff".');
  }

  this.value = ko.observable(ungit.config.diffType || textDiff);
  this.value.subscribe(function (value) {
    self.text(value === textDiff ? "Default" : "Side By Side");
    programEvents.dispatch({ event: 'invalidate-diff-and-render' });
  });
  this.toggle = function () {
    self.value(self.value() === textDiff ? sideBySideDiff : textDiff);
  }
  this.isActive = ko.computed(function () {
    return self.value() === 'textdiff';
  });
}

var WhiteSpace = function () {
  var self = this;

  this.text = ko.observable("Showing White Space diff");
  this.value = ko.observable(false);
  this.value.subscribe(function (value) {
    self.text(value ? "Ignoring White Space diff" : "Showing White Space diff");
    programEvents.dispatch({ event: 'invalidate-diff-and-render' });
  });
  this.toggle = function () {
    self.value(!self.value());
  }
  this.isActive = ko.computed(function () { return !self.value(); });
}

var TextDiffViewModel = function (args) {
  var self = this;
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
  this.diffProgressBar = args.diffProgressBar;
  this.editState = args.editState;
  this.wordWrap = args.wordWrap;
  this.patchLineList = args.patchLineList;
  this.numberOfSelectedPatchLines = 0;
  this.htmlSrc = undefined;
  this.isParsed = ko.observable(false);

  programEvents.add(function (event) {
    if (event.event === "invalidate-diff-and-render" || event.event === "working-tree-changed") {
      self.invalidateDiff();
      if (self.isShowingDiffs()) self.render();
    }
  });

  this.isShowingDiffs.subscribe(function (newValue) {
    if (newValue) self.render();
  });

  if (this.isShowingDiffs()) { this.render(); }
}
TextDiffViewModel.prototype.updateNode = function (parentElement) {
  ko.renderTemplate('textdiff', this, {}, parentElement);
}
TextDiffViewModel.prototype.getDiffArguments = function () {
  return {
    file: this.filename,
    path: this.repoPath(),
    sha1: this.sha1 ? this.sha1 : '',
    whiteSpace: this.whiteSpace.value()
  };
}

TextDiffViewModel.prototype.invalidateDiff = function () {
  this.diffJson = null;
}

TextDiffViewModel.prototype.getDiffJson = function () {
  var self = this;
  return self.server.getPromise('/diff', self.getDiffArguments()).then(function (diffs) {
    if (typeof diffs == 'string') {
      self.diffJson = diff2html.getJsonFromDiff(diffs);
    }
  }).catch(function (err) {
    // The file existed before but has been removed, but we're trying to get a diff for it
    // Most likely it will just disappear with the next refresh of the staging area
    // so we just ignore the error here
    if (err.errorCode != 'no-such-file') throw err;
  });
}

TextDiffViewModel.prototype.render = function (isInvalidate) {
  var self = this;
  return Promise.resolve().then(function () {
    if (!self.diffJson || isInvalidate) {
      return self.getDiffJson();
    }
  }).then(function () {
    if (!self.diffJson || self.diffJson.length == 0) return; // check if diffs are available (binary files do not support them)
    var lineCount = 0;

    if (!self.diffJson[0].isTrimmed) {
      self.diffJson[0].blocks = self.diffJson[0].blocks.reduce(function (blocks, block) {
        var length = block.lines.length;
        if (lineCount < self.loadCount) {
          block.lines = block.lines.slice(0, self.loadCount - lineCount);
          blocks.push(block);
        }
        lineCount += length;
        return blocks;
      }, []);
    }
    self.diffJson[0].isTrimmed = true;

    self.loadMoreCount(Math.min(loadLimit, Math.max(0, lineCount - self.loadCount)));

    var html;

    if (self.textDiffType.value() === 'sidebysidediff') {
      html = diff2html.getPrettySideBySideHtmlFromJson(self.diffJson);
    } else {
      html = diff2html.getPrettyHtmlFromJson(self.diffJson);
    }

    self.numberOfSelectedPatchLines = 0;
    var index = 0;

    // ko's binding resolution is not recursive, which means below ko.bind refresh method doesn't work for
    // data bind at getPatchCheckBox that is rendered with "html" binding.
    // which is reason why manually updating the html content and refreshing kobinding to have it render...
    if (self.patchLineList) {
      html = html.replace(/<span class="d2h-code-line-[a-z]+">(\+|\-)/g, function (match, capture) {
        if (self.patchLineList()[index] === undefined) {
          self.patchLineList()[index] = true;
        }

        return self.getPatchCheckBox(capture, index, self.patchLineList()[index++]);
      });
    }

    if (html !== self.htmlSrc) {
      // diff has changed since last we displayed and need refresh
      self.htmlSrc = html;
      self.isParsed(false);
      self.isParsed(true);
    }
  });
};

TextDiffViewModel.prototype.loadMore = function () {
  this.loadCount += this.loadMoreCount();
  programEvents.dispatch({ event: 'invalidate-diff-and-render' });
}

TextDiffViewModel.prototype.getPatchCheckBox = function (symbol, index, isActive) {
  if (isActive) {
    this.numberOfSelectedPatchLines++;
  }
  return '<div class="d2h-code-line-prefix"><span data-bind="visible: editState() !== \'patched\'">' + symbol + '</span><input ' + (isActive ? 'checked' : '') + ' type="checkbox" data-bind="visible: editState() === \'patched\', click: togglePatchLine.bind($data, ' + index + ')"></input>';
}

TextDiffViewModel.prototype.togglePatchLine = function (index) {
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
