
var expect = require('expect.js');
var gitParser = require('../source/git-parser');

describe('git-parser diff', function () {
  it('should work with non-standard diff header line', function() {
    // Not sure what i/ and w/ exactly means (normally it's a/ and /b), but a user was experiened errors when this wasn't allowed.
    gitParser.parseGitDiff('diff --git i/test w/test');
  });
});

describe('git-parser stash show', function () {
  it('should be possible to parse stashed show', function() {
    var text = ' New Text Document (2).txt | 5 +++++\n 1 file changed, 5 insertions(+)\n';
    var res = gitParser.parseGitStashShow(text);
    expect(res).to.be.an('array');
    expect(res.length).to.be(1);
    expect(res[0].filename).to.be('New Text Document (2).txt');
  });
});