const expect = require('expect.js');
const path = require('path');
const gitParser = require('../source/git-parser');
const dedent = require('dedent');

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
    const gitDiff = dedent`
      diff --git a/package.json b/package.json
      index f71e0064..08964575 100644
      --- a/package.json
      +++ b/package.json
      @@ -87,9 +87,10 @@
        "grunt-mocha-test": "~0.13.3",
        "grunt-plato": "~1.4.0",
        "grunt-release": "~0.14.0",
      - "istanbul": "~0.4.5",
      + "istanbul": "^0.4.5",
        "mocha": "~5.2.0",
        "nightmare": "~3.0.1",
      + "nyc": "^13.1.0",
        "supertest": "~3.3.0"
    `;

    expect(gitParser.parsePatchDiffResult([true, true, true], gitDiff)).to.eql(dedent`
      diff --git a/package.json b/package.json
      index f71e0064..08964575 100644
      --- a/package.json
      +++ b/package.json
      @@ -87,9 +87,10 @@
        "grunt-mocha-test": "~0.13.3",
        "grunt-plato": "~1.4.0",
        "grunt-release": "~0.14.0",
      - "istanbul": "~0.4.5",
      + "istanbul": "^0.4.5",
        "mocha": "~5.2.0",
        "nightmare": "~3.0.1",
      + "nyc": "^13.1.0",
        "supertest": "~3.3.0"
    `);
  });

  it('no diff selected', () => {
    const gitDiff = dedent`
      diff --git a/package.json b/package.json
      index f71e0064..08964575 100644
      --- a/package.json
      +++ b/package.json
      @@ -87,9 +87,10 @@
        "grunt-mocha-test": "~0.13.3",
        "grunt-plato": "~1.4.0",
        "grunt-release": "~0.14.0",
      - "istanbul": "~0.4.5",
      + "istanbul": "^0.4.5",
        "mocha": "~5.2.0",
        "nightmare": "~3.0.1",
      + "nyc": "^13.1.0",
        "supertest": "~3.3.0"
    `;

    expect(gitParser.parsePatchDiffResult([false, false, false], gitDiff)).to.eql(null);
  });

  it('one +- diff selected', () => {
    const gitDiff = dedent`
      diff --git a/package.json b/package.json
      index f71e0064..08964575 100644
      --- a/package.json
      +++ b/package.json
      @@ -87,9 +87,10 @@
      	"grunt-mocha-test": "~0.13.3",
      	"grunt-plato": "~1.4.0",
      	"grunt-release": "~0.14.0",
      -	"istanbul": "~0.4.5",
      +	"istanbul": "^0.4.5",
      	"mocha": "~5.2.0",
      	"nightmare": "~3.0.1",
      +	"nyc": "^13.1.0",
      	"supertest": "~3.3.0"
    `;

    expect(gitParser.parsePatchDiffResult([true, true, false], gitDiff)).to.eql(dedent`
      diff --git a/package.json b/package.json
      index f71e0064..08964575 100644
      --- a/package.json
      +++ b/package.json
      @@ -87,9 +87,9 @@
      	"grunt-mocha-test": "~0.13.3",
      	"grunt-plato": "~1.4.0",
      	"grunt-release": "~0.14.0",
      -	"istanbul": "~0.4.5",
      +	"istanbul": "^0.4.5",
      	"mocha": "~5.2.0",
      	"nightmare": "~3.0.1",
      	"supertest": "~3.3.0"
    `);
  });

  it('only one + diff selected', () => {
    const gitDiff = dedent`
      diff --git a/package.json b/package.json
      index f71e0064..08964575 100644
      --- a/package.json
      +++ b/package.json
      @@ -87,9 +87,10 @@
      	"grunt-mocha-test": "~0.13.3",
      	"grunt-plato": "~1.4.0",
      	"grunt-release": "~0.14.0",
      -	"istanbul": "~0.4.5",
      +	"istanbul": "^0.4.5",
      	"mocha": "~5.2.0",
      	"nightmare": "~3.0.1",
      +	"nyc": "^13.1.0",
      	"supertest": "~3.3.0"
    `;

    expect(gitParser.parsePatchDiffResult([false, false, true], gitDiff)).to.eql(
      'diff --git a/package.json b/package.json\nindex f71e0064..08964575 100644\n--- a/package.json\n+++ b/package.json\n@@ -87,9 +87,10 @@\n\t"grunt-mocha-test": "~0.13.3",\n\t"grunt-plato": "~1.4.0",\n\t"grunt-release": "~0.14.0",\n \t"istanbul": "~0.4.5",\n\t"mocha": "~5.2.0",\n\t"nightmare": "~3.0.1",\n+\t"nyc": "^13.1.0",\n\t"supertest": "~3.3.0"'
    );
  });

  it('works with multiple diffs', () => {
    const gitDiff = dedent`
      diff --git a/README.md b/README.md
      index 96700c3a..dc141a51 100644
      --- a/README.md
      +++ b/README.md
      @@ -1,4 +1,3 @@
      -ungit
      ======
      [![NPM version](https://badge.fury.io/js/ungit.svg)](http://badge.fury.io/js/ungit)
      [![Build Status](https://travis-ci.org/FredrikNoren/ungit.svg)](https://travis-ci.org/FredrikNoren/ungit)
      @@ -133,7 +132,6 @@ Changelog
      See [CHANGELOG.md](CHANGELOG.md).

      -License (MIT)
      See [LICENSE.md](LICENSE.md). To read about the Faircode experiment go to [#974](https://github.com/FredrikNoren/ungit/issues/974). Ungit is now once again MIT.
    `;

    expect(gitParser.parsePatchDiffResult([true, false], gitDiff)).to.eql(
      'diff --git a/README.md b/README.md\nindex 96700c3a..dc141a51 100644\n--- a/README.md\n+++ b/README.md\n@@ -1,4 +1,3 @@\n-ungit\n======\n[![NPM version](https://badge.fury.io/js/ungit.svg)](http://badge.fury.io/js/ungit)\n[![Build Status](https://travis-ci.org/FredrikNoren/ungit.svg)](https://travis-ci.org/FredrikNoren/ungit)\n@@ -133,7 +132,7 @@ Changelog\nSee [CHANGELOG.md](CHANGELOG.md).\n\n License (MIT)\nSee [LICENSE.md](LICENSE.md). To read about the Faircode experiment go to [#974](https://github.com/FredrikNoren/ungit/issues/974). Ungit is now once again MIT.'
    );
  });

  it('works with empty diff', () => {
    expect(gitParser.parsePatchDiffResult([], null)).to.eql(null);
  });
});

describe('git-parser parseGitLog', () => {
  it('should work with branch name with ()', () => {
    const refs = gitParser.parseGitLog('commit AAA BBB (HEAD, (test), fw(4rw), 5), ((, ()')[0].refs;
    expect(refs.length).to.be(6);
  });

  it('should work with no branch name', () => {
    const refs = gitParser.parseGitLog('commit AAA BBB')[0].refs;
    expect(refs.length).to.be(0);
  });

  it('should work with empty lines', () => {
    expect(gitParser.parseGitLog('')).to.eql([]);
  });

  it('parses authors without emails', () => {
    const gitLog = dedent`
      commit 37d1154434b70854ed243967e0d7e37aa3564551 d58c8e117fc257520d90b099fd2c6acd7c1e8861 (HEAD -> refs/heads/git-parser-specs)
      Author:     Test ungit
      Commit:     Test ungit
    `;

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      authorName: 'Test ungit',
      committerName: 'Test ungit',
      additions: 0,
      deletions: 0,
      fileLineDiffs: [],
      isHead: true,
      message: '',
      parents: ['d58c8e117fc257520d90b099fd2c6acd7c1e8861'],
      refs: ['HEAD', 'refs/heads/git-parser-specs'],
      sha1: '37d1154434b70854ed243967e0d7e37aa3564551',
    });
  });

  it('parses multiple commits in a row', () => {
    const gitLog = dedent(`
      commit 5867e2766b0a0f81ad59ce9e9895d9b1a3523aa4 37d1154434b70854ed243967e0d7e37aa3564551 (HEAD -> refs/heads/git-parser-specs)
      Author:     Test ungit <test@example.com>
      AuthorDate: Fri Jan 4 14:54:06 2019 +0100
      Commit:     Test ungit <test@example.com>
      CommitDate: Fri Jan 4 14:54:06 2019 +0100

        parseGitLog + gix reflox parsing

      1	1	source/git-parser.js\x00175	0	test/spec.git-parser.js\x00\x00commit 37d1154434b70854ed243967e0d7e37aa3564551 d58c8e117fc257520d90b099fd2c6acd7c1e8861
      Author:     Test ungit <test@example.com>
      AuthorDate: Fri Jan 4 14:03:56 2019 +0100
      Commit:     Test ungit <test@example.com>
      CommitDate: Fri Jan 4 14:03:56 2019 +0100

        submodules parser

      32	0	test/spec.git-parser.js\x00\x00commit 02efa0da7b1eccb1e0f1c2ff0433ce7387738f60 985617e19e30e9abe0a5711bf455f0dc10f97dff
      Author:     Test ungit <test@example.com>
      AuthorDate: Fri Jan 4 14:02:56 2019 +0100
      Commit:     Test ungit <test@example.com>
      CommitDate: Fri Jan 4 14:02:56 2019 +0100
      
          empty commit
      \x00commit 621a04f931ea9007ac826c04a1a02832e20aa470 4e5d611fdad85bcad44abf65936c95f748abef4e e2dc3ef6e2cbf6ab0acb456c0837257dc01baafd
      Merge: 4e5d611f e2dc3ef6
      Author:     Test ungit <test@example.com>
      AuthorDate: Fri Jan 4 14:01:56 2019 +0100
      Commit:     Test ungit <test@example.com>
      CommitDate: Fri Jan 4 14:01:56 2019 +0100
      
          Merge pull request #1268 from campersau/prepare_152
          
          Prepare version 1.5.2
      \x004	1	CHANGELOG.md\x001	1	package-lock.json\x001	1	package.json\x008	6	source/git-parser.js\x00\x00`);

    const res = gitParser.parseGitLog(gitLog);
    expect(res[0]).to.eql({
      authorDate: 'Fri Jan 4 14:54:06 2019 +0100',
      authorEmail: 'test@example.com',
      authorName: 'Test ungit',
      commitDate: 'Fri Jan 4 14:54:06 2019 +0100',
      committerEmail: 'test@example.com',
      committerName: 'Test ungit',
      additions: 176,
      deletions: 1,
      fileLineDiffs: [
        {
          additions: 1,
          deletions: 1,
          displayName: 'source/git-parser.js',
          fileName: 'source/git-parser.js',
          oldFileName: 'source/git-parser.js',
          type: 'text',
        },
        {
          additions: 175,
          deletions: 0,
          displayName: 'test/spec.git-parser.js',
          fileName: 'test/spec.git-parser.js',
          oldFileName: 'test/spec.git-parser.js',
          type: 'text',
        },
      ],
      isHead: true,
      message: 'parseGitLog + gix reflox parsing',
      parents: ['37d1154434b70854ed243967e0d7e37aa3564551'],
      refs: ['HEAD', 'refs/heads/git-parser-specs'],
      sha1: '5867e2766b0a0f81ad59ce9e9895d9b1a3523aa4',
    });
    expect(res[1]).to.eql({
      authorDate: 'Fri Jan 4 14:03:56 2019 +0100',
      authorEmail: 'test@example.com',
      authorName: 'Test ungit',
      commitDate: 'Fri Jan 4 14:03:56 2019 +0100',
      committerEmail: 'test@example.com',
      committerName: 'Test ungit',
      additions: 32,
      deletions: 0,
      fileLineDiffs: [
        {
          additions: 32,
          deletions: 0,
          displayName: 'test/spec.git-parser.js',
          fileName: 'test/spec.git-parser.js',
          oldFileName: 'test/spec.git-parser.js',
          type: 'text',
        },
      ],
      isHead: false,
      message: 'submodules parser',
      parents: ['d58c8e117fc257520d90b099fd2c6acd7c1e8861'],
      refs: [],
      sha1: '37d1154434b70854ed243967e0d7e37aa3564551',
    });
    // empty commit
    expect(res[2]).to.eql({
      authorDate: 'Fri Jan 4 14:02:56 2019 +0100',
      authorEmail: 'test@example.com',
      authorName: 'Test ungit',
      commitDate: 'Fri Jan 4 14:02:56 2019 +0100',
      committerEmail: 'test@example.com',
      committerName: 'Test ungit',
      additions: 0,
      deletions: 0,
      fileLineDiffs: [],
      isHead: false,
      message: 'empty commit',
      parents: ['985617e19e30e9abe0a5711bf455f0dc10f97dff'],
      refs: [],
      sha1: '02efa0da7b1eccb1e0f1c2ff0433ce7387738f60',
    });
    // merge commit
    expect(res[3]).to.eql({
      authorDate: 'Fri Jan 4 14:01:56 2019 +0100',
      authorEmail: 'test@example.com',
      authorName: 'Test ungit',
      commitDate: 'Fri Jan 4 14:01:56 2019 +0100',
      committerEmail: 'test@example.com',
      committerName: 'Test ungit',
      additions: 14,
      deletions: 9,
      fileLineDiffs: [
        {
          additions: 4,
          deletions: 1,
          displayName: 'CHANGELOG.md',
          fileName: 'CHANGELOG.md',
          oldFileName: 'CHANGELOG.md',
          type: 'text',
        },
        {
          additions: 1,
          deletions: 1,
          displayName: 'package-lock.json',
          fileName: 'package-lock.json',
          oldFileName: 'package-lock.json',
          type: 'text',
        },
        {
          additions: 1,
          deletions: 1,
          displayName: 'package.json',
          fileName: 'package.json',
          oldFileName: 'package.json',
          type: 'text',
        },
        {
          additions: 8,
          deletions: 6,
          displayName: 'source/git-parser.js',
          fileName: 'source/git-parser.js',
          oldFileName: 'source/git-parser.js',
          type: 'text',
        },
      ],
      isHead: false,
      message: 'Merge pull request #1268 from campersau/prepare_152\n\nPrepare version 1.5.2',
      parents: [
        '4e5d611fdad85bcad44abf65936c95f748abef4e',
        'e2dc3ef6e2cbf6ab0acb456c0837257dc01baafd',
      ],
      refs: [],
      sha1: '621a04f931ea9007ac826c04a1a02832e20aa470',
    });
  });

  it('parses multiple commits in a row multiple nul separators', () => {
    const gitLog = dedent(`
      commit ad4c559f05796e78095a51679324cefd9afca879 47185090d5096033db0d5c0bbf883d9295ca084e b360295026ae6afac3525b89145aa22d61e818ff (HEAD -> refs/heads/dev)
      Merge: 4718509 b360295
      Author:     Ungit Commiter <ungit.commiter@example.com>
      AuthorDate: Sat May 22 22:21:04 2021 +0200
      Commit:     Ungit Commiter <ungit.commiter@example.com>
      CommitDate: Sat May 22 22:21:04 2021 +0200

          Merge branch 'a' into dev
      \x00\x00commit 7d7a4d7d9fc625aff46a0ff4d7e95f86d01d25c7 47185090d5096033db0d5c0bbf883d9295ca084e (refs/heads/b)
      Author:     Ungit Commiter <ungit.commiter@example.com>
      AuthorDate: Sat May 22 22:20:28 2021 +0200
      Commit:     Ungit Commiter <ungit.commiter@example.com>
      CommitDate: Sat May 22 22:20:28 2021 +0200

          b
      \x00commit b360295026ae6afac3525b89145aa22d61e818ff 47185090d5096033db0d5c0bbf883d9295ca084e (refs/heads/a)
      Author:     Ungit Commiter <ungit.commiter@example.com>
      AuthorDate: Sat May 22 22:20:23 2021 +0200
      Commit:     Ungit Commiter <ungit.commiter@example.com>
      CommitDate: Sat May 22 22:20:23 2021 +0200

          a
      \x00commit 47185090d5096033db0d5c0bbf883d9295ca084e (refs/heads/master)
      Author:     Ungit Commiter <ungit.commiter@example.com>
      AuthorDate: Sat May 22 22:19:31 2021 +0200
      Commit:     Ungit Commiter <ungit.commiter@example.com>
      CommitDate: Sat May 22 22:19:31 2021 +0200

          Initial commit`);

    const res = gitParser.parseGitLog(gitLog);
    expect(res.length).to.eql(4);
    expect(res[0].message).to.eql("Merge branch 'a' into dev");
    expect(res[1].message).to.eql('b');
    expect(res[2].message).to.eql('a');
    expect(res[3].message).to.eql('Initial commit');
  });

  it('parses reflog commits without email', () => {
    const gitLog = dedent(`
      commit 37d11544 d58c8e11 (HEAD -> refs/heads/git-parser-specs)
      Reflog: git-parser-specs@{Fri Jan 4 14:03:56 2019 +0100} (Test ungit)
      Reflog message: commit: submodules parser
      Author:     Test ungit <test@example.com>
      AuthorDate: Fri Jan 4 14:03:56 2019 +0100
      Commit:     Test ungit <test@example.com>
      CommitDate: Fri Jan 4 14:03:56 2019 +0100

          submodules parser

      32	0	test/spec.git-parser.js\x00\x00`);

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      authorDate: 'Fri Jan 4 14:03:56 2019 +0100',
      authorEmail: 'test@example.com',
      authorName: 'Test ungit',
      commitDate: 'Fri Jan 4 14:03:56 2019 +0100',
      committerEmail: 'test@example.com',
      committerName: 'Test ungit',
      additions: 32,
      deletions: 0,
      fileLineDiffs: [
        {
          additions: 32,
          deletions: 0,
          displayName: 'test/spec.git-parser.js',
          fileName: 'test/spec.git-parser.js',
          oldFileName: 'test/spec.git-parser.js',
          type: 'text',
        },
      ],
      isHead: true,
      message: 'submodules parser',
      parents: ['d58c8e11'],
      reflogAuthorName: 'Test ungit',
      reflogId: 'Fri Jan 4 14:03:56 2019 +0100',
      reflogName: 'git-parser-specs@{Fri',
      refs: ['HEAD', 'refs/heads/git-parser-specs'],
      sha1: '37d11544',
    });
  });

  it('parses reflog commits', () => {
    const gitLog = dedent(`
      commit 37d11544 d58c8e11 (HEAD -> refs/heads/git-parser-specs)
      Reflog: git-parser-specs@{Fri Jan 4 14:03:56 2019 +0100} (Test ungit <test@example.com>)
      Reflog message: commit: submodules parser
      Author:     Test ungit <test@example.com>
      AuthorDate: Fri Jan 4 14:03:56 2019 +0100
      Commit:     Test ungit <test@example.com>
      CommitDate: Fri Jan 4 14:03:56 2019 +0100

          submodules parser

      32	0	test/spec.git-parser.js\x00\x00`);

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      authorDate: 'Fri Jan 4 14:03:56 2019 +0100',
      authorEmail: 'test@example.com',
      authorName: 'Test ungit',
      commitDate: 'Fri Jan 4 14:03:56 2019 +0100',
      committerEmail: 'test@example.com',
      committerName: 'Test ungit',
      additions: 32,
      deletions: 0,
      fileLineDiffs: [
        {
          additions: 32,
          deletions: 0,
          displayName: 'test/spec.git-parser.js',
          fileName: 'test/spec.git-parser.js',
          oldFileName: 'test/spec.git-parser.js',
          type: 'text',
        },
      ],
      isHead: true,
      message: 'submodules parser',
      parents: ['d58c8e11'],
      reflogAuthorEmail: 'test@example.com',
      reflogAuthorName: 'Test ungit',
      reflogId: 'Fri Jan 4 14:03:56 2019 +0100',
      reflogName: 'git-parser-specs@{Fri',
      refs: ['HEAD', 'refs/heads/git-parser-specs'],
      sha1: '37d11544',
    });
  });

  it('parses wrongly signed commits', () => {
    const gitLog = dedent`
      commit 37d1154434b70854ed243967e0d7e37aa3564551 d58c8e117fc257520d90b099fd2c6acd7c1e8861 (HEAD -> refs/heads/git-parser-specs)
      gpg: Signature made Wed Jun  4 19:49:17 2014 PDT using RSA key ID 0AAAAAAA
      gpg: Can't check signature: public key not found
      Author: Test Ungit <test@example.com>
      Date:   Wed Jun 4 19:49:17 2014 -0700
      signed commit
    `;

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      authorEmail: 'test@example.com',
      authorName: 'Test Ungit',
      additions: 0,
      deletions: 0,
      fileLineDiffs: [],
      isHead: true,
      message: '',
      parents: ['d58c8e117fc257520d90b099fd2c6acd7c1e8861'],
      refs: ['HEAD', 'refs/heads/git-parser-specs'],
      sha1: '37d1154434b70854ed243967e0d7e37aa3564551',
    });
  });

  it('parses signed commits', () => {
    const gitLog = dedent`
      commit 37d1154434b70854ed243967e0d7e37aa3564551 d58c8e117fc257520d90b099fd2c6acd7c1e8861 (HEAD -> refs/heads/git-parser-specs)
      gpg: Signature made Wed Jun  4 19:49:17 2014 PDT using RSA key ID 0AAAAAAA
      gpg: Good signature from "Test ungit (Git signing key) <test@example.com>"
      Author: Test Ungit <test@example.com>
      Date:   Wed Jun 4 19:49:17 2014 -0700
      signed commit
    `;

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      authorEmail: 'test@example.com',
      authorName: 'Test Ungit',
      additions: 0,
      deletions: 0,
      fileLineDiffs: [],
      isHead: true,
      message: '',
      parents: ['d58c8e117fc257520d90b099fd2c6acd7c1e8861'],
      refs: ['HEAD', 'refs/heads/git-parser-specs'],
      sha1: '37d1154434b70854ed243967e0d7e37aa3564551',
      signatureDate: 'Wed Jun  4 19:49:17 2014 PDT using RSA key ID 0AAAAAAA',
      signatureMade: '"Test ungit (Git signing key) <test@example.com>"',
    });
  });

  it('parses the git log', () => {
    const gitLog = dedent(`
      commit 37d1154434b70854ed243967e0d7e37aa3564551 d58c8e117fc257520d90b099fd2c6acd7c1e8861 (HEAD -> refs/heads/git-parser-specs)
      Author:     Test ungit <test@example.com>
      AuthorDate: Fri Jan 4 14:03:56 2019 +0100
      Commit:     Test ungit <test@example.com>
      CommitDate: Fri Jan 4 14:03:56 2019 +0100

          submodules parser

      32	0	test/spec.git-parser.js\x00\x00`);

    expect(gitParser.parseGitLog(gitLog)[0]).to.eql({
      refs: ['HEAD', 'refs/heads/git-parser-specs'],
      additions: 32,
      deletions: 0,
      fileLineDiffs: [
        {
          additions: 32,
          deletions: 0,
          displayName: 'test/spec.git-parser.js',
          fileName: 'test/spec.git-parser.js',
          oldFileName: 'test/spec.git-parser.js',
          type: 'text',
        },
      ],
      sha1: '37d1154434b70854ed243967e0d7e37aa3564551',
      parents: ['d58c8e117fc257520d90b099fd2c6acd7c1e8861'],
      isHead: true,
      authorName: 'Test ungit',
      authorEmail: 'test@example.com',
      authorDate: 'Fri Jan 4 14:03:56 2019 +0100',
      committerName: 'Test ungit',
      committerEmail: 'test@example.com',
      commitDate: 'Fri Jan 4 14:03:56 2019 +0100',
      message: 'submodules parser',
    });
  });
});

describe('git-parser submodule', () => {
  it('should work with empty string', () => {
    const gitmodules = '';
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules).to.eql([]);
  });

  it('should work with name, path and url', () => {
    const gitmodules = '[submodule "test1"]\npath = /path/to/sub1\nurl = http://example1.com';
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules.length).to.be(1);
    expect(submodules[0]).to.eql({
      name: 'test1',
      path: path.join('/path', 'to', 'sub1'),
      rawUrl: 'http://example1.com',
      url: 'http://example1.com',
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
      name: 'test1',
      path: path.join('/path', 'to', 'sub1'),
      rawUrl: 'http://example1.com',
      url: 'http://example1.com',
    });
    expect(submodules[1]).to.eql({
      name: 'test2',
      path: path.join('/path', 'to', 'sub2'),
      rawUrl: 'http://example2.com',
      url: 'http://example2.com',
    });
  });

  it('should work with multiple name, path, url, update, branch, fetchRecurseSubmodules and ignore', () => {
    const gitmodules = [
      '[submodule "test1"]\npath = /path/to/sub1\nurl = http://example1.com\nupdate = checkout\nbranch = master\nfetchRecurseSubmodules = true\nignore = all',
      '[submodule  "test2"]\n\npath   = /path/to/sub2\nurl= git://example2.com',
    ].join('\n');
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules.length).to.be(2);
    expect(submodules[0]).to.eql({
      branch: 'master',
      fetchRecurseSubmodules: 'true',
      ignore: 'all',
      name: 'test1',
      path: path.join('/path', 'to', 'sub1'),
      rawUrl: 'http://example1.com',
      update: 'checkout',
      url: 'http://example1.com',
    });
    expect(submodules[1]).to.eql({
      name: 'test2',
      path: path.join('/path', 'to', 'sub2'),
      rawUrl: 'git://example2.com',
      url: 'http://example2.com',
    });
  });

  it('should work with git submodules', () => {
    const gitmodules = dedent`
      [submodule "test1"]
      path = /path/to/sub1
      url = git://example1.com
      update = checkout
      branch = master
      fetchRecurseSubmodules = true
      ignore = all
    `;

    expect(gitParser.parseGitSubmodule(gitmodules)).to.eql([
      {
        name: 'test1',
        path: path.join('/path', 'to', 'sub1'),
        rawUrl: 'git://example1.com',
        url: 'http://example1.com',
        update: 'checkout',
        branch: 'master',
        fetchRecurseSubmodules: 'true',
        ignore: 'all',
      },
    ]);
  });

  it('should work with ssh submodules', () => {
    const gitmodules = dedent`
      [submodule "test1"]
      path = /path/to/sub1
      url = ssh://login@server.com:12345
      update = checkout
      branch = master
      fetchRecurseSubmodules = true
      ignore = all
    `;

    expect(gitParser.parseGitSubmodule(gitmodules)).to.eql([
      {
        name: 'test1',
        path: path.join('/path', 'to', 'sub1'),
        rawUrl: 'ssh://login@server.com:12345',
        url: 'http://server.com/12345',
        update: 'checkout',
        branch: 'master',
        fetchRecurseSubmodules: 'true',
        ignore: 'all',
      },
    ]);
  });
});

describe('parseGitConfig', () => {
  it('parses the git config', () => {
    const gitConfig = dedent`
      user.email=test@example.com
      user.name=Ungit Test
      core.repositoryformatversion=0
      core.filemode=true
      core.bare=false
      core.logallrefupdates=true
      remote.origin.url=git@github.com:ungit/ungit.git
      branch.master.remote=origin
      branch.master.merge=refs/heads/master
    `;

    expect(gitParser.parseGitConfig(gitConfig)).to.eql({
      'user.email': 'test@example.com',
      'user.name': 'Ungit Test',
      'core.repositoryformatversion': '0',
      'core.filemode': 'true',
      'core.bare': 'false',
      'core.logallrefupdates': 'true',
      'remote.origin.url': 'git@github.com:ungit/ungit.git',
      'branch.master.remote': 'origin',
      'branch.master.merge': 'refs/heads/master',
    });
  });
});

describe('parseGitBranches', () => {
  it('parses the branches', () => {
    const gitBranches = dedent`
      * dev
        master
        testbuild
    `;

    expect(gitParser.parseGitBranches(gitBranches)).to.eql([
      { name: 'dev', current: true },
      { name: 'master' },
      { name: 'testbuild' },
    ]);
  });
});

describe('parseGitTags', () => {
  it('parses the tags', () => {
    const gitTags = dedent`
      0.1.0
      0.1.1
      0.1.2
    `;

    expect(gitParser.parseGitTags(gitTags)).to.eql(['0.1.0', '0.1.1', '0.1.2']);
  });
});

describe('parseGitRemotes', () => {
  it('parses the remotes', () => {
    const gitRemotes = dedent`
      origin
      upstream
    `;

    expect(gitParser.parseGitRemotes(gitRemotes)).to.eql([
      { name: 'origin' },
      { name: 'upstream' },
    ]);
  });

  it('parses the remotes with fetch and push url', () => {
    const gitRemotes = dedent`
      origin	http://example1.com
      upstream	http://example2.com (fetch)
      upstream	http://example3.com (push)
    `;

    expect(gitParser.parseGitRemotes(gitRemotes)).to.eql([
      { name: 'origin', url: 'http://example1.com' },
      { name: 'upstream', fetchUrl: 'http://example2.com', pushUrl: 'http://example3.com' },
    ]);
  });
});

describe('parseGitLsRemote', () => {
  it('parses the ls remote', () => {
    const gitLsRemote = dedent`
      86bec6415fa7ec0d7550a62389de86adb493d546	refs/tags/0.1.0
      668ab7beae996c5a7b36da0be64b98e45ba2aa0b	refs/tags/0.1.0^{}
      d3ec9678acf285637ef11c7cba897d697820de07	refs/tags/0.1.1
      ad00b6c8b7b0cbdd0bd92d44dece559b874a4ae6	refs/tags/0.1.1^{}
    `;

    expect(gitParser.parseGitLsRemote(gitLsRemote)).to.eql([
      { sha1: '86bec6415fa7ec0d7550a62389de86adb493d546', name: 'refs/tags/0.1.0' },
      { sha1: '668ab7beae996c5a7b36da0be64b98e45ba2aa0b', name: 'refs/tags/0.1.0^{}' },
      { sha1: 'd3ec9678acf285637ef11c7cba897d697820de07', name: 'refs/tags/0.1.1' },
      { sha1: 'ad00b6c8b7b0cbdd0bd92d44dece559b874a4ae6', name: 'refs/tags/0.1.1^{}' },
    ]);
  });
});

describe('parseGitStatusNumstat', () => {
  it('parses the git status numstat', () => {
    const gitStatusNumstat =
      '1459	202	package-lock.json\x002	1	package.json\x0013	0	test/spec.git-parser.js\x00';

    expect(gitParser.parseGitStatusNumstat(gitStatusNumstat)).to.eql({
      'package-lock.json': { additions: '1459', deletions: '202' },
      'package.json': { additions: '2', deletions: '1' },
      'test/spec.git-parser.js': { additions: '13', deletions: '0' },
    });
  });

  it('skips empty lines', () => {
    const gitStatusNumstat = dedent(`
      1459	202	package-lock.json\x00


      2	1	package.json\x0013	0	test/spec.git-parser.js\x00
    `);

    expect(gitParser.parseGitStatusNumstat(gitStatusNumstat)).to.eql({
      'package-lock.json': { additions: '1459', deletions: '202' },
      'package.json': { additions: '2', deletions: '1' },
      'test/spec.git-parser.js': { additions: '13', deletions: '0' },
    });
  });
});

describe('parseGitStatus', () => {
  it('parses git status', () => {
    const gitStatus =
      '## git-parser-specs\x00' +
      'A  file1.js\x00' +
      'M  file2.js\x00' +
      'D  file3.js\x00' +
      ' D file4.js\x00' +
      ' U file5.js\x00' +
      'U  file6.js\x00' +
      'AA file7.js\x00' +
      '?  file8.js\x00' +
      'A  file9.js\x00' +
      '?D file10.js\x00' +
      'AD file11.js\x00' +
      ' M file12.js\x00' +
      '?? file13.js\x00' +
      'R  ../source/sys.js\x00../source/sysinfo.js\x00';

    expect(gitParser.parseGitStatus(gitStatus)).to.eql({
      branch: 'git-parser-specs',
      files: {
        '../source/sys.js': {
          conflict: false,
          displayName: '../source/sysinfo.js → ../source/sys.js',
          fileName: '../source/sys.js',
          oldFileName: '../source/sysinfo.js',
          isNew: false,
          removed: false,
          renamed: true,
          staged: false,
          type: 'text',
        },
        'file1.js': {
          conflict: false,
          displayName: 'file1.js',
          fileName: 'file1.js',
          oldFileName: 'file1.js',
          isNew: true,
          removed: false,
          renamed: false,
          staged: true,
          type: 'text',
        },
        'file2.js': {
          conflict: false,
          displayName: 'file2.js',
          fileName: 'file2.js',
          oldFileName: 'file2.js',
          isNew: false,
          removed: false,
          renamed: false,
          staged: true,
          type: 'text',
        },
        'file3.js': {
          conflict: false,
          displayName: 'file3.js',
          fileName: 'file3.js',
          oldFileName: 'file3.js',
          isNew: false,
          removed: true,
          renamed: false,
          staged: false,
          type: 'text',
        },
        'file4.js': {
          conflict: false,
          displayName: 'file4.js',
          fileName: 'file4.js',
          oldFileName: 'file4.js',
          isNew: false,
          removed: true,
          renamed: false,
          staged: false,
          type: 'text',
        },
        'file5.js': {
          conflict: true,
          displayName: 'file5.js',
          fileName: 'file5.js',
          oldFileName: 'file5.js',
          isNew: false,
          removed: false,
          renamed: false,
          staged: false,
          type: 'text',
        },
        'file6.js': {
          conflict: true,
          displayName: 'file6.js',
          fileName: 'file6.js',
          oldFileName: 'file6.js',
          isNew: false,
          removed: false,
          renamed: false,
          staged: false,
          type: 'text',
        },
        'file7.js': {
          conflict: true,
          displayName: 'file7.js',
          fileName: 'file7.js',
          oldFileName: 'file7.js',
          isNew: true,
          removed: false,
          renamed: false,
          staged: true,
          type: 'text',
        },
        'file8.js': {
          conflict: false,
          displayName: 'file8.js',
          fileName: 'file8.js',
          oldFileName: 'file8.js',
          isNew: true,
          removed: false,
          renamed: false,
          staged: false,
          type: 'text',
        },
        'file9.js': {
          conflict: false,
          displayName: 'file9.js',
          fileName: 'file9.js',
          oldFileName: 'file9.js',
          isNew: true,
          removed: false,
          renamed: false,
          staged: true,
          type: 'text',
        },
        'file10.js': {
          conflict: false,
          displayName: 'file10.js',
          fileName: 'file10.js',
          oldFileName: 'file10.js',
          isNew: false,
          removed: true,
          renamed: false,
          staged: false,
          type: 'text',
        },
        'file11.js': {
          conflict: false,
          displayName: 'file11.js',
          fileName: 'file11.js',
          oldFileName: 'file11.js',
          isNew: false,
          removed: true,
          renamed: false,
          staged: true,
          type: 'text',
        },
        'file12.js': {
          conflict: false,
          displayName: 'file12.js',
          fileName: 'file12.js',
          oldFileName: 'file12.js',
          isNew: false,
          removed: false,
          renamed: false,
          staged: false,
          type: 'text',
        },
        'file13.js': {
          conflict: false,
          displayName: 'file13.js',
          fileName: 'file13.js',
          oldFileName: 'file13.js',
          isNew: true,
          removed: false,
          renamed: false,
          staged: false,
          type: 'text',
        },
      },
    });
  });
});
