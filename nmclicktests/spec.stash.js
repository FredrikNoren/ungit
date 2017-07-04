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
      .wait('[data-ta-container="staging-file"]')
      .ug.click('[data-ta-clickable="stash-all"]')
      .visible('[data-ta-clickable="stash-toggle"]')
      .then((isVisible) => {
        // if stash is currently collapsed show it. (localStorage['showStash'] might already be 'true')
        return (isVisible ? environment.nm.click('[data-ta-clickable="stash-toggle"]') : environment.nm)
          .wait('[data-ta-container="stash-stash"]')
      });
  });

  it('Should be possible to open stash diff', () => {
    return environment.nm.click('[data-ta-clickable="stash-diff"]')
      .wait('[data-ta-container="stash-diff"]')
  });

  it('Should be possible to pop a stash', () => {
    return environment.nm.click('[data-ta-clickable="stash-pop"]')
      .wait('[data-ta-container="staging-file"]')
  });
});
