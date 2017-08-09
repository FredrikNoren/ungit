'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

describe('[BARE]', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: true }]));
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[0]);
  });

  it('update branches button without branches', () => {
    return environment.nm.ug.click('.btn-group.branch .btn-main')
      .ug.waitForElementNotVisible('.btn-group.branch .btn-main .progress');
  });
});
