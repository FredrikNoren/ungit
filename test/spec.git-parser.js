

var expect = require('expect.js');
var gitParser = require('../source/git-parser');


describe('git-parser diff', function () {
  it('should work with non-standard diff header line', function() {
    // Not sure what i/ and w/ exactly means (normally it's a/ and /b), but a user was experiened errors when this wasn't allowed.
    gitParser.parseGitDiff('diff --git i/test w/test');
  });
});
