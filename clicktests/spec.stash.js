'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

describe('[STASH]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: false, initCommits: 1 }]);
  });

  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.openUngit(testRepoPaths[0]);
  });

  it('Should be possible to stash a file', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/testfile2.txt`, testRepoPaths[0]);
    await environment.waitForElementVisible('.files .file .btn-default');
    await environment.click('.stash-all');
    await environment.click('.stash-toggle');
    await environment.waitForElementVisible('.stash .list-group-item');
  });

  it('Should be possible to open stash diff', async () => {
    await environment.click('.toggle-show-commit-diffs');
    await environment.waitForElementVisible('.stash .diff-wrapper');
  });

  it('Should be possible to pop a stash', async () => {
    await environment.click('.stash .stash-apply');
    await environment.waitForElementVisible('.files .file .btn-default');
  });
});
