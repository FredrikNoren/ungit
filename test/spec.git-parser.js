
var expect = require('expect.js');
var gitParser = require('../source/git-parser');

describe('git-parser stash show', function () {
  it('should be possible to parse stashed show', function() {
    var text = ' New Text Document (2).txt | 5 +++++\n 1 file changed, 5 insertions(+)\n';
    var res = gitParser.parseGitStashShow(text);
    expect(res).to.be.an('array');
    expect(res.length).to.be(1);
    expect(res[0].filename).to.be('New Text Document (2).txt');
  });
});

describe('git-parse diff on big change', function() {
  describe('git-parser parseGitLog', function () {
    it('should work with branch name with ()', function() {
      var refs = gitParser.parseGitLog('commit AAA BBB (HEAD, (test), fw(4rw), 5), ((, ()')[0].refs;

      if(refs.length != 6) {
        throw new Error('Failed to parse git log with branch name with ().');
      }
    });
    it('should work with no branch name', function() {
      var refs = gitParser.parseGitLog('commit AAA BBB')[0].refs;

      if(refs.length != 0) {
        throw new Error('Failed to parse git log without branches.');
      }
    });
  });
});
