
var ko = require('knockout');
var components = require('ungit-components');
var diff2html = require('diff2html').Diff2Html;
var programEvents = require('ungit-program-events');

components.register('textdiff', function(args) {
  return new TextDiffViewModel(args);
});

components.register('textdiff.type', function() {
  return new Type();
});

components.register('textdiff.wordwrap', function() {
  return new WordWrap();
});

components.register('textdiff.whitespace', function() {
  return new WhiteSpace();
});

var loadLimit = 100;

var WordWrap = function() {
  var self = this;

  this.text = ko.observable("No Wrap");
  this.value = ko.observable(false);
  this.value.subscribe(function(value) {
    self.text(value ? "Word Wrap" : "No Wrap");
  });
  this.toggle = function() {
    self.value(!self.value());
  }
  this.isActive = ko.computed(function() { return !!self.value(); });
}

var Type = function() {
  var self = this;
  var sideBySideDiff = 'sidebysidediff'
  var textDiff = 'textdiff'

  this.text = ko.observable("Default");
  this.value = ko.observable(textDiff);
  this.value.subscribe(function(value) {
    self.text(value === textDiff ? "Default" : "Side By Side");
    programEvents.dispatch({ event: 'invalidate-diff' });
  });
  this.toggle = function() {
    self.value(self.value() === textDiff ? sideBySideDiff : textDiff);
  }
  this.isActive = ko.computed(function() {
    return self.value() === 'textdiff';
  });
}

var WhiteSpace = function() {
  var self = this;

  this.text = ko.observable("Showing White Space diff");
  this.value = ko.observable(false);
  this.value.subscribe(function(value) {
    self.text(value ? "Ignoring White Space diff" : "Showing White Space diff");
    programEvents.dispatch({ event: 'invalidate-diff' });
  });
  this.toggle = function() {
    self.value(!self.value());
  }
  this.isActive = ko.computed(function() { return !self.value(); });
}

var TextDiffViewModel = function(args) {
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

  programEvents.add(function(event) {
    if (event.event === "invalidate-diff" && self.isShowingDiffs()) {
      self.invalidateDiff();
    }
  });
}
TextDiffViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('textdiff', this, {}, parentElement);
}
TextDiffViewModel.prototype.getDiffArguments = function() {
  return {
    file: this.filename,
    path: this.repoPath(),
    sha1: this.sha1 ? this.sha1 : '',
    whiteSpace: this.whiteSpace.value()
  };
}

TextDiffViewModel.prototype.invalidateDiff = function(callback) {
  var self = this;
  if (this.isShowingDiffs()) {
    if (this.diffProgressBar) this.diffProgressBar.start();

    self.server.get('/diff', this.getDiffArguments() , function(err, diffs) {
      if (err) {
        if (self.diffProgressBar) self.diffProgressBar.stop();
        if (err.errorCode == 'no-such-file') {
          // The file existed before but has been removed, but we're trying to get a diff for it
          // Most likely it will just disappear with the next refresh of the staging area
          // so we just ignore the error here
          return true;
        }
        return callback ? callback(err) : null;
      }
      if (typeof diffs == 'string') {
        self.diffJson = diff2html.getJsonFromDiff(diffs);
        self.render();
      }

      if (self.diffProgressBar) self.diffProgressBar.stop();
      if (callback) callback();
    });
  } else {
    if (callback) callback();
  }
}

TextDiffViewModel.prototype.render = function() {
  if (this.diffJson.length == 0) return; // check if diffs are available (binary files do not support them)

  var self = this;
  this.isParsed(false);
  var diffJsonCopy = JSON.parse(JSON.stringify(this.diffJson)); // make a json copy
  var lineCount = 0;

  diffJsonCopy[0].blocks = diffJsonCopy[0].blocks.reduce(function(blocks, block) {
    var length = block.lines.length;
    if (lineCount < self.loadCount) {
      block.lines = block.lines.slice(0, self.loadCount - lineCount);
      blocks.push(block);
    }
    lineCount += length;
    return blocks;
  }, []);

  this.loadMoreCount(Math.min(loadLimit, Math.max(0, lineCount - this.loadCount)));

  var html;

  if (this.textDiffType.value() === 'sidebysidediff') {
    html = diff2html.getPrettySideBySideHtmlFromJson(diffJsonCopy);
  } else {
    html = diff2html.getPrettyHtmlFromJson(diffJsonCopy);
  }

  var index = 0;
  this.numberOfSelectedPatchLines = 0;

  // if self.patchLineList is null then patching is not avaliable so skip this expensive op.x
  if (self.patchLineList) {
    html = html.replace(/<span class="d2h-code-line-[a-z]+">(\+|\-)/g, function (match, capture) {
      if (self.patchLineList()[index] === undefined) {
        self.patchLineList()[index] = true;
      }

      return self.getPatchCheckBox(capture, index, self.patchLineList()[index++]);
    });
  }

  // ko's binding resolution is not recursive, which means below ko.bind refresh method doesn't work for
  // data bind at getPatchCheckBox that is rendered with "html" binding.
  // which is reason why manually updating the html content and refreshing kobinding to have it render...
  this.htmlSrc = html;
  this.isParsed(true);
};

TextDiffViewModel.prototype.loadMore = function(callback) {
  this.loadCount += this.loadMoreCount();
  this.render();
}

TextDiffViewModel.prototype.getPatchCheckBox = function(symbol, index, isActive) {
  if (isActive) {
    this.numberOfSelectedPatchLines++;
  }
  return '<div class="d2h-code-line-prefix"><span data-bind="visible: editState() !== \'patched\'">' + symbol + '</span><input ' + (isActive ? 'checked' : '') + ' type="checkbox" data-ta-clickable="patch-line-input" data-bind="visible: editState() === \'patched\', click: togglePatchLine.bind($data, ' + index + ')"></input>';
}

TextDiffViewModel.prototype.togglePatchLine = function(index) {
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
