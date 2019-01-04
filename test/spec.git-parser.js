const expect = require('expect.js');
const path = require('path');
const gitParser = require('../src/git-parser');

describe('git-parser stash show', () => {
  it('should be possible to parse stashed show', () => {
    const text = ' New Text Document (2).txt | 5 +++++\n 1 file changed, 5 insertions(+)\n';
    const res = gitParser.parseGitStashShow(text);
    expect(res).to.be.an('array');
    expect(res.length).to.be(1);
    expect(res[0]).to.eql({ filename: 'New Text Document (2).txt' });
  });
});

describe('git-parser parseDiffResult', () => {
  it('all diff selected', () => {
    var gitDiff = 'diff --git a/package.json b/package.json\n'
    gitDiff += 'index f71e0064..08964575 100644\n'
    gitDiff += '--- a/package.json\n'
    gitDiff += '+++ b/package.json\n'
    gitDiff += '@@ -87,9 +87,10 @@\n'
    gitDiff += '\t"grunt-mocha-test": "~0.13.3",\n'
    gitDiff += '\t"grunt-plato": "~1.4.0",\n'
    gitDiff += '\t"grunt-release": "~0.14.0",\n'
    gitDiff += '-\t"istanbul": "~0.4.5",\n'
    gitDiff += '+\t"istanbul": "^0.4.5",\n'
    gitDiff += '\t"mocha": "~5.2.0",\n'
    gitDiff += '\t"nightmare": "~3.0.1",\n'
    gitDiff += '+\t"nyc": "^13.1.0",\n'
    gitDiff += '\t"supertest": "~3.3.0"\n'
    
    expect(gitParser.parsePatchDiffResult([true, true, true], gitDiff)).to.eql('diff --git a/package.json b/package.json\nindex f71e0064..08964575 100644\n--- a/package.json\n+++ b/package.json\n@@ -87,9 +87,10 @@\n\t"grunt-mocha-test": "~0.13.3",\n\t"grunt-plato": "~1.4.0",\n\t"grunt-release": "~0.14.0",\n-\t"istanbul": "~0.4.5",\n+\t"istanbul": "^0.4.5",\n\t"mocha": "~5.2.0",\n\t"nightmare": "~3.0.1",\n+\t"nyc": "^13.1.0",\n\t"supertest": "~3.3.0"')
  });
  it('no diff selected', () => {
    var gitDiff = 'diff --git a/package.json b/package.json\n'
    gitDiff += 'index f71e0064..08964575 100644\n'
    gitDiff += '--- a/package.json\n'
    gitDiff += '+++ b/package.json\n'
    gitDiff += '@@ -87,9 +87,10 @@\n'
    gitDiff += '\t"grunt-mocha-test": "~0.13.3",\n'
    gitDiff += '\t"grunt-plato": "~1.4.0",\n'
    gitDiff += '\t"grunt-release": "~0.14.0",\n'
    gitDiff += '-\t"istanbul": "~0.4.5",\n'
    gitDiff += '+\t"istanbul": "^0.4.5",\n'
    gitDiff += '\t"mocha": "~5.2.0",\n'
    gitDiff += '\t"nightmare": "~3.0.1",\n'
    gitDiff += '+\t"nyc": "^13.1.0",\n'
    gitDiff += '\t"supertest": "~3.3.0"\n'
    
    expect(gitParser.parsePatchDiffResult([false, false, false], gitDiff)).to.eql(null)
  });
  it('one +- diff selected', () => {
    var gitDiff = 'diff --git a/package.json b/package.json\n'
    gitDiff += 'index f71e0064..08964575 100644\n'
    gitDiff += '--- a/package.json\n'
    gitDiff += '+++ b/package.json\n'
    gitDiff += '@@ -87,9 +87,10 @@\n'
    gitDiff += '\t"grunt-mocha-test": "~0.13.3",\n'
    gitDiff += '\t"grunt-plato": "~1.4.0",\n'
    gitDiff += '\t"grunt-release": "~0.14.0",\n'
    gitDiff += '-\t"istanbul": "~0.4.5",\n'
    gitDiff += '+\t"istanbul": "^0.4.5",\n'
    gitDiff += '\t"mocha": "~5.2.0",\n'
    gitDiff += '\t"nightmare": "~3.0.1",\n'
    gitDiff += '+\t"nyc": "^13.1.0",\n'
    gitDiff += '\t"supertest": "~3.3.0"\n'
    
    expect(gitParser.parsePatchDiffResult([true, true, false], gitDiff)).to.eql('diff --git a/package.json b/package.json\nindex f71e0064..08964575 100644\n--- a/package.json\n+++ b/package.json\n@@ -87,9 +87,9 @@\n\t"grunt-mocha-test": "~0.13.3",\n\t"grunt-plato": "~1.4.0",\n\t"grunt-release": "~0.14.0",\n-\t"istanbul": "~0.4.5",\n+\t"istanbul": "^0.4.5",\n\t"mocha": "~5.2.0",\n\t"nightmare": "~3.0.1",\n\t"supertest": "~3.3.0"')
  });
  it('only one + diff selected', () => {
    var gitDiff = 'diff --git a/package.json b/package.json\n'
    gitDiff += 'index f71e0064..08964575 100644\n'
    gitDiff += '--- a/package.json\n'
    gitDiff += '+++ b/package.json\n'
    gitDiff += '@@ -87,9 +87,10 @@\n'
    gitDiff += '\t"grunt-mocha-test": "~0.13.3",\n'
    gitDiff += '\t"grunt-plato": "~1.4.0",\n'
    gitDiff += '\t"grunt-release": "~0.14.0",\n'
    gitDiff += '-\t"istanbul": "~0.4.5",\n'
    gitDiff += '+\t"istanbul": "^0.4.5",\n'
    gitDiff += '\t"mocha": "~5.2.0",\n'
    gitDiff += '\t"nightmare": "~3.0.1",\n'
    gitDiff += '+\t"nyc": "^13.1.0",\n'
    gitDiff += '\t"supertest": "~3.3.0"\n'

    expect(gitParser.parsePatchDiffResult([false, false, true], gitDiff)).to.eql('diff --git a/package.json b/package.json\nindex f71e0064..08964575 100644\n--- a/package.json\n+++ b/package.json\n@@ -87,9 +87,10 @@\n\t"grunt-mocha-test": "~0.13.3",\n\t"grunt-plato": "~1.4.0",\n\t"grunt-release": "~0.14.0",\n \t"istanbul": "~0.4.5",\n\t"mocha": "~5.2.0",\n\t"nightmare": "~3.0.1",\n+\t"nyc": "^13.1.0",\n\t"supertest": "~3.3.0"')
  });
  it('works with multiple diffs', () => {
    var gitDiff = 'diff --git a/README.md b/README.md\n'
    gitDiff += 'index 96700c3a..dc141a51 100644\n'
    gitDiff += '--- a/README.md\n'
    gitDiff += '+++ b/README.md\n'
    gitDiff += '@@ -1,4 +1,3 @@\n'
    gitDiff += '-ungit\n'
    gitDiff += '======\n'
    gitDiff += '[![NPM version](https://badge.fury.io/js/ungit.svg)](http://badge.fury.io/js/ungit)\n'
    gitDiff += '[![Build Status](https://travis-ci.org/FredrikNoren/ungit.svg)](https://travis-ci.org/FredrikNoren/ungit)\n'
    gitDiff += '@@ -133,7 +132,6 @@ Changelog\n'
    gitDiff += 'See [CHANGELOG.md](CHANGELOG.md).\n'
    gitDiff += '\n'
    gitDiff += '-License (MIT)\n'
    gitDiff += 'See [LICENSE.md](LICENSE.md). To read about the Faircode experiment go to [#974](https://github.com/FredrikNoren/ungit/issues/974). Ungit is now once again MIT.\n'

    expect(gitParser.parsePatchDiffResult([true, false], gitDiff)).to.eql('diff --git a/README.md b/README.md\nindex 96700c3a..dc141a51 100644\n--- a/README.md\n+++ b/README.md\n@@ -1,4 +1,3 @@\n-ungit\n======\n[![NPM version](https://badge.fury.io/js/ungit.svg)](http://badge.fury.io/js/ungit)\n[![Build Status](https://travis-ci.org/FredrikNoren/ungit.svg)](https://travis-ci.org/FredrikNoren/ungit)\n@@ -133,7 +132,7 @@ Changelog\nSee [CHANGELOG.md](CHANGELOG.md).\n\n License (MIT)\nSee [LICENSE.md](LICENSE.md). To read about the Faircode experiment go to [#974](https://github.com/FredrikNoren/ungit/issues/974). Ungit is now once again MIT.')
  });
  it('works with empty diff', () => {
    expect(gitParser.parsePatchDiffResult([], null)).to.eql('')
  });
});

describe('git-parser parseGitLog', () => {
  it('should work with branch name with ()', () => {
    const refs = gitParser.parseGitLog('commit AAA BBB (HEAD, (test), fw(4rw), 5), ((, ()')[0].refs;
    expect(refs.length).to.be(6)
  });
  it('should work with no branch name', () => {
    const refs = gitParser.parseGitLog('commit AAA BBB')[0].refs;
    expect(refs.length).to.be(0)
  });
  it('should work with empty lines', () => {
    expect(gitParser.parseGitLog('')).to.eql([]);
  });
  it('parses authors without emails', () => {
    var gitLog = 'commit 37d1154434b70854ed243967e0d7e37aa3564551 d58c8e117fc257520d90b099fd2c6acd7c1e8861 (HEAD -> refs/heads/git-parser-specs)\n'
    gitLog += 'Author:     Test ungit\n'
    gitLog += 'Commit:     Test ungit\n'

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      authorName: "Test ungit",
      committerName: "Test ungit",
      fileLineDiffs: [],
      isHead: true,
      message: "",
      parents: [
        "d58c8e117fc257520d90b099fd2c6acd7c1e8861"
      ],
      refs: [
        "HEAD",
        "refs/heads/git-parser-specs"
      ],
      sha1: "37d1154434b70854ed243967e0d7e37aa3564551"
    })
  });
  it('parses multiple commits in a row', () => {
    var gitLog = 'commit 5867e2766b0a0f81ad59ce9e9895d9b1a3523aa4 37d1154434b70854ed243967e0d7e37aa3564551 (HEAD -> refs/heads/git-parser-specs)\n'
    gitLog += 'Author:     Test ungit <test@example.com>\n'
    gitLog += 'AuthorDate: Fri Jan 4 14:54:06 2019 +0100\n'
    gitLog += 'Commit:     Test ungit <test@example.com>\n'
    gitLog += 'CommitDate: Fri Jan 4 14:54:06 2019 +0100\n'
    gitLog += '\n'
    gitLog += '\tparseGitLog + gix reflox parsing\n'
    gitLog += '\n'
    gitLog += '1\t1\tsource/git-parser.js\n'
    gitLog += '175\t0\ttest/spec.git-parser.js\n'
    gitLog += '\n'
    gitLog += 'commit 37d1154434b70854ed243967e0d7e37aa3564551 d58c8e117fc257520d90b099fd2c6acd7c1e8861\n'
    gitLog += 'Author:     Test ungit <test@example.com>\n'
    gitLog += 'AuthorDate: Fri Jan 4 14:03:56 2019 +0100\n'
    gitLog += 'Commit:     Test ungit <test@example.com>\n'
    gitLog += 'CommitDate: Fri Jan 4 14:03:56 2019 +0100\n'
    gitLog += '\n'
    gitLog += '\tsubmodules parser\n'
    gitLog += '\n'
    gitLog += '32\t0\ttest/spec.git-parser.js\n'

    var res = gitParser.parseGitLog(gitLog)
    expect(res[0]).to.eql({
      authorDate: "Fri Jan 4 14:54:06 2019 +0100",
      authorEmail: "test@example.com",
      authorName: "Test ungit",
      commitDate: "Fri Jan 4 14:54:06 2019 +0100",
      committerEmail: "test@example.com",
      committerName: "Test ungit",
      fileLineDiffs: [
        [176, 1, "Total"],
        [1, 1, "source/git-parser.js", "text"],
        [175, 0, "test/spec.git-parser.js", "text"],
      ],
      isHead: true,
      message: "parseGitLog + gix reflox parsing",
      parents: [
        "37d1154434b70854ed243967e0d7e37aa3564551"
      ],
      refs: [
        "HEAD",
        "refs/heads/git-parser-specs"
      ],
      sha1: "5867e2766b0a0f81ad59ce9e9895d9b1a3523aa4"
    })
    expect(res[1]).to.eql({
      authorDate: "Fri Jan 4 14:03:56 2019 +0100",
      authorEmail: "test@example.com",
      authorName: "Test ungit",
      commitDate: "Fri Jan 4 14:03:56 2019 +0100",
      committerEmail: "test@example.com",
      committerName: "Test ungit",
      fileLineDiffs: [
        [32, 0, "Total"],
        [32, 0, "test/spec.git-parser.js", "text"],
      ],
      isHead: false,
      message: "submodules parser",
      parents: [
        "d58c8e117fc257520d90b099fd2c6acd7c1e8861",
      ],
      refs: [],
      sha1: "37d1154434b70854ed243967e0d7e37aa3564551"
    })
  });
  it('parses reflog commits without email', () => {
    var gitLog = 'commit 37d11544 d58c8e11 (HEAD -> refs/heads/git-parser-specs)\n'
    gitLog += 'Reflog: git-parser-specs@{Fri Jan 4 14:03:56 2019 +0100} (Test ungit)\n'
    gitLog += 'Reflog message: commit: submodules parser\n'
    gitLog += 'Author:     Test ungit <test@example.com>\n'
    gitLog += 'AuthorDate: Fri Jan 4 14:03:56 2019 +0100\n'
    gitLog += 'Commit:     Test ungit <test@example.com>\n'
    gitLog += 'CommitDate: Fri Jan 4 14:03:56 2019 +0100\n'
    gitLog += '\n'
    gitLog += '    submodules parser\n'
    gitLog += '\n'
    gitLog += '32\t0\ttest/spec.git-parser.js\n'

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      authorDate: "Fri Jan 4 14:03:56 2019 +0100",
      authorEmail: "test@example.com",
      authorName: "Test ungit",
      commitDate: "Fri Jan 4 14:03:56 2019 +0100",
      committerEmail: "test@example.com",
      committerName: "Test ungit",
      fileLineDiffs: [
        [32, 0, "Total"],
        [32, 0, "test/spec.git-parser.js", "text"]
      ],
      isHead: true,
      message: "submodules parser",
      parents: [
        "d58c8e11"
      ],
      reflogAuthorName: "Test ungit",
      reflogId: "Fri Jan 4 14:03:56 2019 +0100",
      reflogName: "git-parser-specs@{Fri",
      refs: [
        "HEAD",
        "refs/heads/git-parser-specs"
      ],
      sha1: "37d11544"
    })
  });
  it('parses reflog commits', () => {
    var gitLog = 'commit 37d11544 d58c8e11 (HEAD -> refs/heads/git-parser-specs)\n'
    gitLog += 'Reflog: git-parser-specs@{Fri Jan 4 14:03:56 2019 +0100} (Test ungit <test@example.com>)\n'
    gitLog += 'Reflog message: commit: submodules parser\n'
    gitLog += 'Author:     Test ungit <test@example.com>\n'
    gitLog += 'AuthorDate: Fri Jan 4 14:03:56 2019 +0100\n'
    gitLog += 'Commit:     Test ungit <test@example.com>\n'
    gitLog += 'CommitDate: Fri Jan 4 14:03:56 2019 +0100\n'
    gitLog += '\n'
    gitLog += '    submodules parser\n'
    gitLog += '\n'
    gitLog += '32\t0\ttest/spec.git-parser.js\n'

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      authorDate: "Fri Jan 4 14:03:56 2019 +0100",
      authorEmail: "test@example.com",
      authorName: "Test ungit",
      commitDate: "Fri Jan 4 14:03:56 2019 +0100",
      committerEmail: "test@example.com",
      committerName: "Test ungit",
      fileLineDiffs: [
        [32, 0, "Total"],
        [32, 0, "test/spec.git-parser.js", "text"]
      ],
      isHead: true,
      message: "submodules parser",
      parents: [
        "d58c8e11"
      ],
      reflogAuthorEmail: "test@example.com",
      reflogAuthorName: "Test ungit",
      reflogId: "Fri Jan 4 14:03:56 2019 +0100",
      reflogName: "git-parser-specs@{Fri",
      refs: [
        "HEAD",
        "refs/heads/git-parser-specs"
      ],
      sha1: "37d11544"
    })
  });
  it('parses wrongly signed commits', () => {
    var gitLog = 'commit 37d1154434b70854ed243967e0d7e37aa3564551 d58c8e117fc257520d90b099fd2c6acd7c1e8861 (HEAD -> refs/heads/git-parser-specs)\n'
    gitLog += 'gpg: Signature made Wed Jun  4 19:49:17 2014 PDT using RSA key ID 0AAAAAAA\n'
    gitLog += "gpg: Can't check signature: public key not found\n"
    gitLog += 'Author: Test Ungit <test@example.com>\n'
    gitLog += 'Date:   Wed Jun 4 19:49:17 2014 -0700\n'
    gitLog += 'signed commit'

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      authorEmail: "test@example.com",
      authorName: "Test Ungit",
      fileLineDiffs: [],
      isHead: true,
      message: "",
      parents: [
        "d58c8e117fc257520d90b099fd2c6acd7c1e8861"
      ],
      refs: [
        "HEAD",
        "refs/heads/git-parser-specs"
      ],
      sha1: "37d1154434b70854ed243967e0d7e37aa3564551",
    });
  });
  it('parses signed commits', () => {
    var gitLog = 'commit 37d1154434b70854ed243967e0d7e37aa3564551 d58c8e117fc257520d90b099fd2c6acd7c1e8861 (HEAD -> refs/heads/git-parser-specs)\n'
    gitLog += 'gpg: Signature made Wed Jun  4 19:49:17 2014 PDT using RSA key ID 0AAAAAAA\n'
    gitLog += 'gpg: Good signature from "Test ungit (Git signing key) <test@example.com>"\n'
    gitLog += 'Author: Test Ungit <test@example.com>\n'
    gitLog += 'Date:   Wed Jun 4 19:49:17 2014 -0700\n'
    gitLog += 'signed commit'

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      authorEmail: "test@example.com",
      authorName: "Test Ungit",
      fileLineDiffs: [],
      isHead: true,
      message: "",
      parents: [
        "d58c8e117fc257520d90b099fd2c6acd7c1e8861"
      ],
      refs: [
        "HEAD",
        "refs/heads/git-parser-specs"
      ],
      sha1: "37d1154434b70854ed243967e0d7e37aa3564551",
      signatureDate: "Wed Jun  4 19:49:17 2014 PDT using RSA key ID 0AAAAAAA",
      signatureMade: '"Test ungit (Git signing key) <test@example.com>"'
    });
  });
  it('parses the git log', () => {
    var gitLog = 'commit 37d1154434b70854ed243967e0d7e37aa3564551 d58c8e117fc257520d90b099fd2c6acd7c1e8861 (HEAD -> refs/heads/git-parser-specs)\n'
    gitLog += 'Author:     Test ungit <test@example.com>\n'
    gitLog += 'AuthorDate: Fri Jan 4 14:03:56 2019 +0100\n'
    gitLog += 'Commit:     Test ungit <test@example.com>\n'
    gitLog += 'CommitDate: Fri Jan 4 14:03:56 2019 +0100\n'
    gitLog += '\n'
    gitLog += '    submodules parser\n'
    gitLog += '\n'
    gitLog += '32\t0\ttest/spec.git-parser.js\n'

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql(
      { 
        refs: [ 'HEAD', 'refs/heads/git-parser-specs' ],
        fileLineDiffs: [
          [32, 0, "Total"],
          [32, 0, "test/spec.git-parser.js", "text"]
        ],
        sha1: '37d1154434b70854ed243967e0d7e37aa3564551',
        parents: [ 'd58c8e117fc257520d90b099fd2c6acd7c1e8861' ],
        isHead: true,
        authorName: 'Test ungit',
        authorEmail: 'test@example.com',
        authorDate: 'Fri Jan 4 14:03:56 2019 +0100',
        committerName: 'Test ungit',
        committerEmail: 'test@example.com',
        commitDate: 'Fri Jan 4 14:03:56 2019 +0100',
        message: 'submodules parser',
      }
    );
  });
});

describe('git-parser submodule', () => {
  it('should work with empty string', () => {
    const gitmodules = "";
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules).to.eql({})
  });
  it('should work with name, path and url', () => {
    const gitmodules = '[submodule "test1"]\npath = /path/to/sub1\nurl = http://example1.com';
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules.length).to.be(1);
    expect(submodules[0]).to.eql({
      name: "test1",
      path: "/path/to/sub1",
      rawUrl: "http://example1.com",
      url: "http://example1.com"
    });
  });
  it('should work with multiple name, path and url', () => {
    const gitmodules = [
      '[submodule "test1"]\npath = /path/to/sub1\nurl = http://example1.com',
      '[submodule "test2"]\npath = /path/to/sub2\nurl = http://example2.com',
    ].join('\n');
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules.length).to.be(2);
    expect(submodules[0]).to.eql({
      name: "test1",
      path: "/path/to/sub1",
      rawUrl: "http://example1.com",
      url: "http://example1.com"
    })
    expect(submodules[1]).to.eql({
      name: "test2",
      path: "/path/to/sub2",
      rawUrl: "http://example2.com",
      url: "http://example2.com"
    })
  });
  it('should work with multiple name, path, url, update, branch, fetchRecurseSubmodules and ignore', () => {
    const gitmodules = [
      '[submodule "test1"]\npath = /path/to/sub1\nurl = http://example1.com\nupdate = checkout\nbranch = master\nfetchRecurseSubmodules = true\nignore = all',
      '[submodule  "test2"]\n\npath   ==/path/to/sub2\nurl= git://example2.com',
    ].join('\n');
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules.length).to.be(2);
    expect(submodules[0]).to.eql({
      branch: "master",
      fetchRecurseSubmodules: "true",
      ignore: "all",
      name: "test1",
      path: "/path/to/sub1",
      rawUrl: "http://example1.com",
      update: "checkout",
      url: "http://example1.com"
    })
    expect(submodules[1]).to.eql({
      name: "test2",
      path: "=/path/to/sub2",
      rawUrl: "git://example2.com",
      url: "http://example2.com"
    })
  });
  it('should work with git submodules', () => {
    var gitmodules = '[submodule "test1"]\npath = /path/to/sub1\nurl = git://example1.com\nupdate = checkout\nbranch = master\nfetchRecurseSubmodules = true\nignore = all\n'

    expect(gitParser.parseGitSubmodule(gitmodules)).to.eql([
      { 
        name: 'test1',
        path: '/path/to/sub1',
        rawUrl: 'git://example1.com',
        url: 'http://example1.com',
        update: 'checkout',
        branch: 'master',
        fetchRecurseSubmodules: 'true',
        ignore: 'all'
      }
    ]);
  });
  it('should work with ssh submodules', () => {
    var gitmodules = '[submodule "test1"]\npath = /path/to/sub1\nurl = ssh://login@server.com:12345\nupdate = checkout\nbranch = master\nfetchRecurseSubmodules = true\nignore = all\n'

    expect(gitParser.parseGitSubmodule(gitmodules)).to.eql([
      { 
        name: 'test1',
        path: '/path/to/sub1',
        rawUrl: 'ssh://login@server.com:12345',
        url: 'http://server.com/12345',
        update: 'checkout',
        branch: 'master',
        fetchRecurseSubmodules: 'true',
        ignore: 'all'
      }
    ]);
  });
});

describe('parseGitConfig', () => {
  it('parses the git config', () => {
    var gitConfig = 'user.email=test@example.com\n'
    gitConfig += 'user.name=Ungit Test\n'
    gitConfig += 'core.repositoryformatversion=0\n'
    gitConfig += 'core.filemode=true\n'
    gitConfig += 'core.bare=false\n'
    gitConfig += 'core.logallrefupdates=true\n'
    gitConfig += 'remote.origin.url=git@github.com:ungit/ungit.git\n'
    gitConfig += 'branch.master.remote=origin\n'
    gitConfig += 'branch.master.merge=refs/heads/master'

    expect(gitParser.parseGitConfig(gitConfig)).to.eql({
      'user.email': 'test@example.com',
      'user.name': 'Ungit Test',
      'core.repositoryformatversion': '0',
      'core.filemode': 'true',
      'core.bare': 'false',
      'core.logallrefupdates': 'true',
      'remote.origin.url': 'git@github.com:ungit/ungit.git',
      'branch.master.remote': 'origin',
      'branch.master.merge': 'refs/heads/master'
    });
  })
});

describe('parseGitBranches', () => {
  it('parses the branches', () => {
    var gitBranches = '* dev\n'
    gitBranches += '  master\n'
    gitBranches += '  testbuild\n'

    expect(gitParser.parseGitBranches(gitBranches)).to.eql([
      { "name":"dev", "current": true},
      {"name":"master"},
      {"name":"testbuild"}
    ]);
  });
});

describe('parseGitTags', () => {
  it('parses the tags', () => {
    var gitTags = '0.1.0\n'
    gitTags += '0.1.1\n'
    gitTags += '0.1.2\n'
    
    expect(gitParser.parseGitTags(gitTags)).to.eql([
      '0.1.0',
      '0.1.1',
      '0.1.2'
    ]);
  });
})

describe('parseGitRemotes', () => {
  it('parses the remotes', () => {
    var gitRemotes = 'origin\n'
    gitRemotes += 'upstream'
    
    expect(gitParser.parseGitRemotes(gitRemotes)).to.eql([
      'origin',
      'upstream'
    ]);
  });
});

describe('parseGitLsRemote', () => {
  it('parses the ls remote', () => {
    var gitLsRemote = '86bec6415fa7ec0d7550a62389de86adb493d546	refs/tags/0.1.0\n'
    gitLsRemote += '668ab7beae996c5a7b36da0be64b98e45ba2aa0b	refs/tags/0.1.0^{}\n'
    gitLsRemote += 'd3ec9678acf285637ef11c7cba897d697820de07	refs/tags/0.1.1\n'
    gitLsRemote += 'ad00b6c8b7b0cbdd0bd92d44dece559b874a4ae6	refs/tags/0.1.1^{}\n'
    
    expect(gitParser.parseGitLsRemote(gitLsRemote)).to.eql([
      { sha1: "86bec6415fa7ec0d7550a62389de86adb493d546", name: "refs/tags/0.1.0" },
      { sha1: "668ab7beae996c5a7b36da0be64b98e45ba2aa0b", name: "refs/tags/0.1.0^{}"},
      { sha1: "d3ec9678acf285637ef11c7cba897d697820de07", name: "refs/tags/0.1.1"},
      { sha1: "ad00b6c8b7b0cbdd0bd92d44dece559b874a4ae6", name: "refs/tags/0.1.1^{}"}
    ]);
  });
});

describe('parseGitStatusNumstat', () => {
  it('parses the git status numstat', () => {
    var gitStatusNumstat = '1459\t202\tpackage-lock.json\n'
    gitStatusNumstat += '2\t1\tpackage.json\n'
    gitStatusNumstat += '13\t0\ttest/spec.git-parser.js'
    
    expect(gitParser.parseGitStatusNumstat(gitStatusNumstat)).to.eql({
      "package-lock.json": { additions: "1459", deletions: "202" },
      "package.json": { additions: "2", deletions: "1" },
      "test/spec.git-parser.js": { additions: "13", deletions: "0" }
    });
  })
  it('skips empty lines', () => {
    var gitStatusNumstat = '1459\t202\tpackage-lock.json\n'
    gitStatusNumstat += '\n'
    gitStatusNumstat += '\n'
    gitStatusNumstat += '2\t1\tpackage.json\n'
    gitStatusNumstat += '13\t0\ttest/spec.git-parser.js'
    
    expect(gitParser.parseGitStatusNumstat(gitStatusNumstat)).to.eql({
      "package-lock.json": { additions: "1459", deletions: "202" },
      "package.json": { additions: "2", deletions: "1" },
      "test/spec.git-parser.js": { additions: "13", deletions: "0" }
    });
  })
});

describe('parseGitStatus', () => {
  it('parses git status', () => {
    var gitStatus = '## git-parser-specs\n'
    gitStatus += 'A  file1.js\n'
    gitStatus += 'M  file2.js\n'
    gitStatus += 'D  file3.js\n'
    gitStatus += ' D file4.js\n'
    gitStatus += ' U file5.js\n'
    gitStatus += 'U  file6.js\n'
    gitStatus += 'AA file7.js\n'
    gitStatus += '?  file8.js\n'
    gitStatus += 'A  file9.js\n'
    gitStatus += '?D file10.js\n'
    gitStatus += 'AD file11.js\n'
    gitStatus += ' M file12.js\n'
    gitStatus += '?? file13.js\n'
    gitStatus += '\n'
    gitStatus += 'R  ../source/sysinfo.js -> ../source/sys.js'

    expect(gitParser.parseGitStatus(gitStatus)).to.eql({
        branch: "git-parser-specs",
        files: {
          "../source/sys.js": {
            conflict: false, displayName: "../source/sysinfo.js -> ../source/sys.js", isNew: false, removed: false, renamed: true, staged: false, type: "text"
          },
          "file1.js": {
            conflict: false, displayName: "file1.js", isNew: true, removed: false, renamed: false, staged: true, type: "text"
          },
          "file2.js": {
            conflict: false, displayName: "file2.js", isNew: false, removed: false, renamed: false, staged: true, type: "text"
          },
          "file3.js": {
            conflict: false, displayName: "file3.js", isNew: false, removed: true, renamed: false, staged: false, type: "text"
          },
          "file4.js": {
            conflict: false, displayName: "file4.js", isNew: false, removed: true, renamed: false, staged: false, type: "text"
          },
          "file5.js": {
            conflict: true, displayName: "file5.js", isNew: false, removed: false, renamed: false, staged: false, type: "text"
          },
          "file6.js": {
            conflict: true, displayName: "file6.js", isNew: false, removed: false, renamed: false, staged: false, type: "text"
          },
          "file7.js": {
            conflict: true, displayName: "file7.js", isNew: true, removed: false, renamed: false, staged: true, type: "text"
          },
          "file8.js": {
            conflict: false, displayName: "file8.js", isNew: true, removed: false, renamed: false, staged: false, type: "text"
          },
          "file9.js": {
            conflict: false, displayName: "file9.js", isNew: true, removed: false, renamed: false, staged: true, type: "text"
          },
          "file10.js": {
            conflict: false, displayName: "file10.js", isNew: false, removed: true, renamed: false, staged: false, type: "text"
          },
          "file11.js": {
            conflict: false, displayName: "file11.js", isNew: false, removed: true, renamed: false, staged: true, type: "text"
          },
          "file12.js": {
            conflict: false, displayName: "file12.js", isNew: false, removed: false, renamed: false, staged: false, type: "text"
          },
          "file13.js": {
            conflict: false, displayName: "file13.js", isNew: true, removed: false, renamed: false, staged: false, type: "text"
          }
        },
      inited: true,
      isMoreToLoad: false
    })
  });
});
