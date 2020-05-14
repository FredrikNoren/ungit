'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

describe('[SUMBODULES]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [
      { bare: false, initCommits: 1 },
      { bare: false },
    ]);
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.openUngit(testRepoPaths[1]);
  });

  it('Submodule add', async () => {
    await environment.click('.submodule .dropdown-toggle');
    await environment.click('.fetchButton .add-submodule');

    await environment.insert('.modal #Path', 'subrepo');
    await environment.insert('.modal #Url', testRepoPaths[0]);
    await environment.click('.modal-dialog .btn-primary');

    await environment.click('.submodule .dropdown-toggle');
    await environment.waitForElementVisible(
      '.fetchButton .dropdown-menu [data-ta-clickable="subrepo"]'
    );
  });

  it('Submodule update', async () => {
    await environment.click('.fetchButton .update-submodule');
    await environment.waitForElementHidden('#nprogress');
  });

  it('Submodule delete check', async () => {
    await environment.click('.submodule .dropdown-toggle');
    await environment.click('[data-ta-clickable="subrepo-remove"]');
    await environment.click('.modal-dialog .btn-primary');
    await environment.waitForElementHidden('#nprogress');
  });
});
