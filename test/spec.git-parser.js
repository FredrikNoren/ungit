
const expect = require('expect.js');
const path = require('path');
const gitParser = require('../src/git-parser');

describe('git-parser stash show', () => {
  it('should be possible to parse stashed show', () => {
    const text = ' New Text Document (2).txt | 5 +++++\n 1 file changed, 5 insertions(+)\n';
    const res = gitParser.parseGitStashShow(text);
    expect(res).to.be.an('array');
    expect(res.length).to.be(1);
    expect(res[0].filename).to.be('New Text Document (2).txt');
  });
});

describe('git-parse diff on big change', () => {
  describe('git-parser parseGitLog', () => {
    it('should work with branch name with ()', () => {
      const refs = gitParser.parseGitLog('commit AAA BBB (HEAD, (test), fw(4rw), 5), ((, ()')[0].refs;

      if(refs.length != 6) {
        throw new Error('Failed to parse git log with branch name with ().');
      }
    });
    it('should work with no branch name', () => {
      const refs = gitParser.parseGitLog('commit AAA BBB')[0].refs;

      if(refs.length != 0) {
        throw new Error('Failed to parse git log without branches.');
      }
    });
  });
});

describe('git-parser submodule', () => {
  it('should work with empty string', () => {
    const gitmodules = "";
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules).to.be.an('object').and.to.be.empty();
  });
  it('should work with name, path and url', () => {
    const gitmodules = '[submodule "test1"]\npath = /path/to/sub1\nurl = http://example1.com';
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules.length).to.be(1);
    expect(submodules[0].name).to.be('test1');
    expect(submodules[0].path).to.be(path.join(path.sep, 'path', 'to', 'sub1'));
    expect(submodules[0].url).to.be('http://example1.com');
  });
  it('should work with multiple name, path and url', () => {
    const gitmodules = [
      '[submodule "test1"]\npath = /path/to/sub1\nurl = http://example1.com',
      '[submodule "test2"]\npath = /path/to/sub2\nurl = http://example2.com',
    ].join('\n');
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules.length).to.be(2);
    expect(submodules[0].name).to.be('test1');
    expect(submodules[0].path).to.be(path.join(path.sep, 'path', 'to', 'sub1'));
    expect(submodules[0].url).to.be('http://example1.com');
    expect(submodules[1].name).to.be('test2');
    expect(submodules[1].path).to.be(path.join(path.sep, 'path', 'to', 'sub2'));
    expect(submodules[1].url).to.be('http://example2.com');
  });
  it('should work with multiple name, path, url, update, branch, fetchRecurseSubmodules and ignore', () => {
    const gitmodules = [
      '[submodule "test1"]\npath = /path/to/sub1\nurl = http://example1.com\nupdate = checkout\nbranch = master\nfetchRecurseSubmodules = true\nignore = all',
      '[submodule  "test2"]\n\npath   ==/path/to/sub2\nurl= git://example2.com',
    ].join('\n');
    const submodules = gitParser.parseGitSubmodule(gitmodules);
    expect(submodules.length).to.be(2);
    expect(submodules[0].name).to.be('test1');
    expect(submodules[0].path).to.be(path.join(path.sep, 'path', 'to', 'sub1'));
    expect(submodules[0].url).to.be('http://example1.com');
    expect(submodules[0].update).to.be('checkout');
    expect(submodules[0].branch).to.be('master');
    expect(submodules[0].fetchRecurseSubmodules).to.be('true');
    expect(submodules[0].ignore).to.be('all');
    expect(submodules[1].name).to.be('test2');
    expect(submodules[1].path).to.be(path.join('=', 'path', 'to', 'sub2'));
    expect(submodules[1].url).to.be('http://example2.com');
    expect(submodules[1].rawUrl).to.be('git://example2.com');
  });
});
