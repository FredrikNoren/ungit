'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

describe('[STASH]', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false, initCommits: 1 }]))
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[0]);
  });

  it('Should be possible to stash a file', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile2.txt`)
      .wait('.files .file .btn-default')
      .ug.click('.stash-all')
      .visible('.stash-toggle')
      .then((isVisible) => {
        // if stash is currently collapsed show it. (localStorage['showStash'] might already be 'true')
        return (isVisible ? environment.nm.click('.stash-toggle') : environment.nm)
          .wait('.stash .list-group-item')
      });
  });

  it('Should be possible to open stash diff', () => {
    return environment.nm.click('.toggle-show-commit-diffs')
      .wait('.stash .diff-wrapper')
  });

  it('Should be possible to pop a stash', () => {
    return environment.nm.click('.stash .stash-apply')
      .wait('.files .file .btn-default')
  });
});
