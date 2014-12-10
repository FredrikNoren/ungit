var ko = require('knockout');
var components = require('ungit-components');

var textDiffOptions = [ { name: 'Default Diff', component: 'textdiff', nextIndex: 1 },
                        { name: 'Side-by-Side Diff', component: 'sidebysidediff', nextIndex: 0 }];

components.register('textDiffType', function(args) {
  return new TextDiffType(args);
});

var TextDiffType = function() {
  this.textDiffType = ko.observable(textDiffOptions[0]);
}
TextDiffType.prototype.toggleDiffDisplayType = function() {
  this.textDiffType(textDiffOptions[this.textDiffType().nextIndex]);
}
TextDiffType.prototype.getNextDiffDisplayTypeText = function() {
  return textDiffOptions[this.textDiffType().nextIndex].name;
}
