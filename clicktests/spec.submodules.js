'use strict';
const path = require('path');
const fs = require('fs').promises;
const { encodePath } = require('../source/address-parser');
const environment = require('./environment')();
const testRepoPaths = [];
const submodulePath = 'sdk-js/src/sub repo & test';

describe('[SUMBODULES]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [
      { bare: false, initCommits: 1 },
      { bare: false },
    ]);
    for (let i = 0; i < testRepoPaths.length; i++) {
      testRepoPaths[i] = await fs.realpath(testRepoPaths[i]);
    }
  });

  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.openUngit(testRepoPaths[1]);
  });

  it('Submodule add', async () => {
    await environment.click('.submodule .dropdown-toggle');
    await environment.click('.fetchButton .add-submodule');

    await environment.insert('.modal #Path', submodulePath);
    await environment.insert('.modal #Url', testRepoPaths[0]);
    await environment.awaitAndClick('.modal-dialog .btn-primary');
    await environment.ensureRedraw();
  });

  it('Submodule update', async () => {
    await environment.click('.submodule .dropdown-toggle');
    await environment.waitForElementVisible(
      `.fetchButton .dropdown-menu [data-ta-clickable="${submodulePath}"]`
    );
    const submoduleResponseProm = environment.setApiListener('/submodules/update', 'POST');
    await environment.awaitAndClick('.fetchButton .update-submodule');
    await submoduleResponseProm;
  });

  for (const directory of ['', 'sdk-js']) {
    it(`Submodule navigation from ${directory || 'repository root'}`, async () => {
      await environment.openUngit(path.join(testRepoPaths[1], directory));
      await environment.click('.submodule .dropdown-toggle');
      await environment.awaitAndClick(`[data-ta-clickable="${submodulePath}"]`);
      const expectedHash = `#/repository?path=${encodePath(
        path.join(testRepoPaths[1], submodulePath)
      )}`;
      await environment.page.waitForFunction(
        (hash) => window.location.hash === hash,
        {},
        expectedHash
      );
      await environment.waitForElementVisible('.repository-actions');
    });
  }

  it('Submodule delete check', async () => {
    await environment.openUngit(testRepoPaths[1]);
    const submoduleDeleteResponseProm = environment.setApiListener('/submodules?', 'DELETE');
    await environment.click('.submodule .dropdown-toggle');
    await environment.click(`[data-ta-clickable="${submodulePath}-remove"]`);
    await environment.awaitAndClick('.modal-dialog .btn-primary');
    await submoduleDeleteResponseProm;
  });
});
