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
    const apiResponseProm = environment.setApiListener('/branches?', 'GET');
    const refResponseProm = environment.setApiListener('/refs?', 'GET');
    await environment.click('.btn-group.branch .btn-main');
    await apiResponseProm;
    await refResponseProm;
  });
});
