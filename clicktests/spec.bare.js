'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

describe('[BARE]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: true }]);
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.openUngit(testRepoPaths[0]);
  });

  it('update branches button without branches', async () => {
    await environment.setApiListener('/branches?', 'GET', 'ungit.__branchGetResponed');
    await environment.setApiListener('/refs?', 'GET', 'ungit.__refsGetResponed');
    await environment.click('.btn-group.branch .btn-main');
    await environment.page.waitForFunction('ungit.__branchGetResponed');
    await environment.page.waitForFunction('ungit.__refsGetResponed');
  });
});
