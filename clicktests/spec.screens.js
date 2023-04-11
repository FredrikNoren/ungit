'use strict';
const environment = require('./environment')();
const mkdirp = require('mkdirp').mkdirp;
const rimraf = require('rimraf').rimraf;
const { encodePath } = require('../source/address-parser');
const testRepoPaths = [];

describe('[SCREENS]', () => {
  before('Environment init', () => environment.init());

  after('Environment stop', () => environment.shutdown());

  it('Open home screen', async () => {
    await environment.goto(environment.getRootUrl());
    await environment.waitForElementVisible('.home');
  });

  it('Open path screen', async () => {
    testRepoPaths.push(await environment.createTempFolder());

    await environment.goto(
      `${environment.getRootUrl()}/#/repository?path=${encodePath(testRepoPaths[0])}`
    );
    await environment.waitForElementVisible('.uninited');
  });

  it('Init repository should bring you to repo page', async () => {
    await environment.click('.uninited button.btn-primary');
    await environment.waitForElementVisible('.repository-view');
  });

  it('Clicking logo should bring you to home screen', async () => {
    await environment.click('.navbar .backlink');
    await environment.waitForElementVisible('.home');
    await environment.wait(1000);
  });

  it('Entering an invalid path and create directory in that location', async () => {
    await environment.insert(
      '.navbar .path-input-form input',
      `${testRepoPaths[0]}-test0/not/existing`
    );
    await environment.press('Enter');
    await environment.waitForElementVisible('.invalid-path');
    await environment.click('.invalid-path button');
    await environment.waitForElementVisible('.uninited button.btn-primary');
    await environment.wait(1000);
  });

  it('Entering an invalid path should bring you to an error screen', async () => {
    await environment.insert('.navbar .path-input-form input', '/a/path/that/doesnt/exist');
    await environment.press('Enter');
    await environment.waitForElementVisible('.invalid-path');
    await environment.wait(1000);
  });

  it('Entering a path to a repo should bring you to that repo', async () => {
    await environment.insert('.navbar .path-input-form input', testRepoPaths[0]);
    await environment.press('Enter');
    await environment.waitForElementVisible('.repository-view');
    await environment.wait(1000);
  });

  // getting odd cross-domain-error.
  it('Create test directory with ampersand and open it', async () => {
    const specialRepoPath = `${testRepoPaths[0]}-test1/test & repo`;

    await rimraf(specialRepoPath);
    await mkdirp(specialRepoPath);

    await environment.goto(
      `${environment.getRootUrl()}/#/repository?path=${encodePath(specialRepoPath)}`
    );

    await environment.waitForElementVisible('.uninited');
  });
});
