var ko = require('knockout');
var components = require('ungit-components');

var textDiffs = [ { name: 'Default Diff', component: 'textdiff', nextIndex: 1 },
                  { name: 'Side-by-Side Diff', component: 'sidebysidediff', nextIndex: 0 }];

components.register('textDiffOptions', function(args) {
  return new TextDiffOptions(args);
});

var TextDiffOptions = function() {
  this.textDiffType = ko.observable(textDiffs[0]);
}
TextDiffOptions.prototype.toggleDiffDisplayType = function() {
  this.textDiffType(textDiffs[this.textDiffType().nextIndex]);
}
TextDiffOptions.prototype.getNextDiffDisplayTypeText = function() {
  return textDiffs[this.textDiffType().nextIndex].name;
}
