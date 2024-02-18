'use strict';
const environment = require('./environment')();
const mkdirp = require('mkdirp').mkdirp;
const rimraf = require('rimraf').rimraf;
const { encodePath } = require('../source/address-parser');
const testRepoPaths = [];

describe('[REMOTES]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: true }, { bare: false, initCommits: 2 }]);

    testRepoPaths.push(`${testRepoPaths[1]}-cloned`); // A directory to test cloning
    await rimraf(testRepoPaths[2]); // clean clone test dir
    await mkdirp(testRepoPaths[2]); // create clone test dir
  });

  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.openUngit(testRepoPaths[1]);
  });

  it('Should not be possible to push without remote', async () => {
    await environment.click('.branch[data-ta-name="master"][data-ta-local="true"]');
    await environment.ensureRedraw();
    await environment.waitForElementHidden('[data-ta-action="push"]:not([style*="display: none"])');
  });

  it('Should not be possible to commit & push without remote', async () => {
    await environment.click('.amend-link');
    await environment.click('.commit-grp .dropdown-toggle');
    await environment.ensureRedraw();
    await environment.waitForElementVisible('.commitnpush.disabled');
  });

  it('Adding a remote', async () => {
    await environment.click('.fetchButton .dropdown-toggle');
    await environment.click('.add-new-remote');

    await environment.insert('.modal #Name', 'myremote');
    await environment.insert('.modal #Url', testRepoPaths[0]);
    await environment.awaitAndClick('.modal .modal-footer .btn-primary');
    await environment.ensureRedraw();
    await environment.click('.fetchButton .dropdown-toggle');
    await environment.waitForElementVisible(
      '.fetchButton .dropdown-menu [data-ta-clickable="myremote"]'
    );
  });

  it('Fetch from newly added remote', async () => {
    const remoteGetResponseProm = environment.setApiListener('/remote/tags?', 'GET');
    await environment.click('.fetchButton .btn-main');
    await remoteGetResponseProm;
  });

  it('Remote delete check', async () => {
    await environment.click('.fetchButton .dropdown-toggle');
    await environment.click('[data-ta-clickable="myremote-remove"]');
    await environment.awaitAndClick('.modal-dialog .btn-primary');
    await environment.ensureRedraw();
    await environment.click('.fetchButton .dropdown-toggle');
    await environment.waitForElementHidden('[data-ta-clickable="myremote"]');
  });

  // ----------- CLONING -------------
  it('navigate to empty folder path', async () => {
    await environment.goto(
      `${environment.getRootUrl()}/#/repository?path=${encodePath(testRepoPaths[2])}`
    );
    await environment.waitForElementVisible('.uninited');
  });

  it('Clone repository should bring you to repo page', async () => {
    await environment.insert('#cloneFromInput', testRepoPaths[1]);
    await environment.insert('#cloneToInput', testRepoPaths[2]);
    await environment.click('.uninited button[type="submit"]');
    await environment.waitForElementVisible('.repository-view');
    await environment.wait(1000); // ensure click bindings are initialized
  });

  it('Should be possible to fetch', async () => {
    const remoteGetResponseProm = environment.setApiListener('/remote/tags?', 'GET');
    await environment.click('.fetchButton .btn-main');
    await remoteGetResponseProm;
  });

  it('Should be possible to create and push a branch', async () => {
    await environment.createBranch('branchinclone');
    await environment.pushRefAction('branchinclone', true);
    await environment.waitForElementVisible('[data-ta-name="origin/branchinclone"]');
  });

  it('Should be possible to force push a branch', async () => {
    await environment.moveRef('branchinclone', 'Init Commit 0');
    await environment.pushRefAction('branchinclone', true);
    await environment.waitForElementHidden('[data-ta-action="push"]:not([style*="display: none"])');
  });

  it('Check for fetching remote branches for the branch list', async () => {
    await environment.click('.branch .dropdown-toggle');
    await environment.click('.options input');

    await environment.ensureRedraw();

    await environment.click('.options input');
    await environment.waitForElementVisible('li .octicon-globe');
  });

  it('checkout remote branches with matching local branch at wrong place', async () => {
    await environment.moveRef('branchinclone', 'Init Commit 1');
    await environment.click('.branch .dropdown-toggle');
    await environment.click('[data-ta-clickable="checkoutrefs/remotes/origin/branchinclone"]');
    await environment.ensureRedraw();
    await environment.waitForElementVisible('[data-ta-name="branchinclone"][data-ta-local="true"]');
  });

  it('Should be possible to commitnpush', async () => {
    await environment.createTestFile(`${testRepoPaths[2]}/commitnpush.txt`, testRepoPaths[2]);
    await environment.waitForElementVisible('.files .file .btn-default');
    await environment.insert('.staging input.form-control', 'Commit & Push');
    await environment.wait(250);
    await environment.click('.commit-grp .dropdown-toggle');
    await environment.click('.commitnpush');
    await environment.waitForElementVisible(
      '[data-ta-node-title="Commit & Push"] .commit-container'
    );
  });

  it('Should be possible to commitnpush with ff', async () => {
    await environment.click('.amend-link');
    await environment.insert('.staging input.form-control', 'Commit & Push with ff');
    await environment.click('.commit-grp .dropdown-toggle');
    await environment.click('.commitnpush');
    await environment.awaitAndClick('.modal-dialog .btn-primary');
    await environment.waitForElementVisible(
      '[data-ta-node-title="Commit & Push with ff"] .commit-container'
    );
  });
});
