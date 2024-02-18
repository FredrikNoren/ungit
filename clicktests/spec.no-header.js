'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

describe('[NO-HEADER]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: false }]);
  });

  after('Environment stop', () => environment.shutdown());

  it('Open path screen', async () => {
    await environment.openUngit(testRepoPaths[0]);
    await environment.waitForElementVisible('.repository-view');
    await environment.waitForElementHidden('[data-ta-container="remote-error-popup"]');
  });

  it('Check for refresh button', async () => {
    await environment.click('.refresh-button');
    await environment.waitForElementHidden('[data-ta-container="remote-error-popup"]');
  });
});
