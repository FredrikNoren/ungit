
var expect = require('expect.js');
var gitParser = require('../source/git-parser');

describe('git-parser diff', function () {
  it('should work with non-standard diff header line', function() {
    // Not sure what i/ and w/ exactly means (normally it's a/ and /b), but a user was experiened errors when this wasn't allowed.
    gitParser.parseGitDiff('diff --git i/test w/test', [false]);
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

describe('git-parse diff on big change', function() {
  it('diff on big change sould show display limit amount of changed lines first', function() {
    var sampleText = "diff --git a/source/git-parser.js b/source/git-parser.js\nindex 643e964..df31474 100644\n--- a/source/git-parser.js\n+++ b/source/git-parser.js\n@@ -22,12 +22,12 @@ exports.parseGitStatus = function(text) {\n   return result;\n };\n";
    sampleText += '1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n';
    sampleText += '1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n';

    var res = gitParser.parseGitDiff(sampleText, {isLoadingAllLines: 'false', initialLineDisplayLimit: 50});
    expect(res).to.be.an('array');
    expect(res.length).to.be(1);
    expect(res[0].lines.length).to.be(50);
    expect(res[0].totalNumberOfLines).to.be(63);


    res = gitParser.parseGitDiff(sampleText, {isLoadingAllLines: 'true', initialLineDisplayLimit: 50});
    expect(res).to.be.an('array');
    expect(res.length).to.be(1);
    expect(res[0].lines.length).to.be(63);
    expect(res[0].totalNumberOfLines).to.be(63);

    res = gitParser.parseGitDiff(sampleText, {isLoadingAllLines: 'false', initialLineDisplayLimit: 100});
    expect(res).to.be.an('array');
    expect(res.length).to.be(1);
    expect(res[0].lines.length).to.be(63);
    expect(res[0].totalNumberOfLines).to.be(63);

    sampleText += '1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n';
    sampleText += '1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n';
    
    res = gitParser.parseGitDiff(sampleText, {isLoadingAllLines: 'false', initialLineDisplayLimit: 100});
    expect(res).to.be.an('array');
    expect(res.length).to.be(1);
    expect(res[0].lines.length).to.be(100);
    expect(res[0].totalNumberOfLines).to.be(123);
  });
});

