'use strict';
const environment = require('./environment')();
const Bluebird = require('bluebird');
const mkdirp = Bluebird.promisifyAll(require("mkdirp")).mkdirPAsync;
const rimraf = Bluebird.promisify(require("rimraf"));
const testRepoPaths = [];

describe('[REMOTES]', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: true }, { bare: false, initCommits: 2 }]))
      .then(() => testRepoPaths.push(`${testRepoPaths[1]}-cloned`)) // A directory to test cloning
      .then(() => rimraf(testRepoPaths[2]))   // clean clone test dir
      .then(() => mkdirp(testRepoPaths[2]));  // create clone test dir
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[1]);
  });

  it('Adding a remote', () => {
    return environment.nm.ug.click('[data-ta-clickable="remotes-menu"]')
      .ug.click('[data-ta-clickable="show-add-remote-dialog"]')
      .wait('[data-ta-container="add-remote"]')
      .insert('[data-ta-container="add-remote"] [data-ta-input="name"]', 'myremote')
      .insert('[data-ta-container="add-remote"] [data-ta-input="url"]', testRepoPaths[0])
      .click('[data-ta-container="add-remote"] [data-ta-clickable="submit"]')
      .wait(500)
      .click('[data-ta-clickable="remotes-menu"]')
      .wait('[data-ta-container="remotes"] [data-ta-clickable="myremote"]');
  });

  it('Fetch from newly added remote', () => {
    return environment.nm.click('[data-ta-clickable="fetch"]')
      .wait(500)
      .ug.waitForElementNotVisible('[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]')
  });

  it('Remote delete check', () => {
    return environment.nm.click('[data-ta-clickable="remotes-menu"]')
      .ug.click('[data-ta-clickable="myremote-remove"]')
      .ug.click('[data-ta-clickable="yes"]')
      .ug.waitForElementNotVisible('[data-ta-element="progress-bar"]')
      .ug.click('[data-ta-clickable="remotes-menu"]')
      .exists('[data-ta-clickable="myremote"]')
      .then((isVisible) => { if (isVisible) throw new Error('Remote exists after delete'); });
  });

  // ----------- CLONING -------------
  it('navigate to empty folder path', () => {
    return environment.nm.goto(`${environment.getRootUrl()}/#/repository?path=${encodeURIComponent(testRepoPaths[2])}`)
      .wait('[data-ta-container="uninited-path-page"]');
  });

  it('Clone repository should bring you to repo page', () => {
    return environment.nm.insert('[data-ta-input="clone-url"]', testRepoPaths[1])
      .insert('[data-ta-input="clone-target"]', testRepoPaths[2])
      .ug.click('[data-ta-clickable="clone-repository"]')
      .refresh()  // this is currently neccessary as cloning -> repo view transition is not straight forward
                  // and previous test depends on mouse wiggle that triggers refresh.
      .wait('[data-ta-container="repository-view"]')
      .exists('[data-ta-container="remote-error-popup"]')
      .then((isVisible) => { if (isVisible) throw new Error('Should not find remote error popup'); });
  });

  it('Should be possible to fetch', () => {
    return environment.nm.click('[data-ta-clickable="fetch"]')
      .wait('[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]')
      .ug.waitForElementNotVisible('[data-ta-clickable="fetch"][data-ta-element="progress-bar"]');
  });

  it('Should be possible to create and push a branch', () => {
    return environment.nm.ug.createBranch('branchinclone')
      .ug.refAction('branchinclone', true, 'push')
      .wait('[data-ta-name="origin/branchinclone"]');
  });

  it('Should be possible to force push a branch', () => {
    return environment.nm.ug.moveRef('branchinclone', 'Init Commit 0')
      .ug.refAction('branchinclone', true, 'push')
      .ug.waitForElementNotVisible('[data-ta-action="push"][data-ta-visible="true"]')
  });
});
