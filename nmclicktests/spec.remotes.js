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
    return environment.nm.ug.click('.fetchButton .dropdown-toggle')
      .ug.click('.add-new-remote')
      .wait('.modal')
      .insert('.modal #Name', 'myremote')
      .insert('.modal #Url', testRepoPaths[0])
      .click('.modal .modal-footer input')
      .wait(500)
      .click('.fetchButton .dropdown-toggle')
      .wait('.fetchButton .dropdown-menu [data-ta-clickable="myremote"]');
  });

  it('Fetch from newly added remote', () => {
    return environment.nm.click('.fetchButton .btn-main')
      .wait(500)
      .ug.waitForElementNotVisible('.fetchButton .btn-main .progress')
  });

  it('Remote delete check', () => {
    return environment.nm.click('.fetchButton .dropdown-toggle')
      .ug.click('[data-ta-clickable="myremote-remove"]')
      .ug.click('.modal-dialog .btn-primary')
      .ug.waitForElementNotVisible('.progress')
      .ug.click('.fetchButton .dropdown-toggle')
      .exists('[data-ta-clickable="myremote"]')
      .then((isVisible) => { if (isVisible) throw new Error('Remote exists after delete'); });
  });

  // ----------- CLONING -------------
  it('navigate to empty folder path', () => {
    return environment.nm.goto(`${environment.getRootUrl()}/#/repository?path=${encodeURIComponent(testRepoPaths[2])}`)
      .wait('.uninited');
  });

  it('Clone repository should bring you to repo page', () => {
    return environment.nm.insert('#cloneFromInput', testRepoPaths[1])
      .insert('#cloneToInput', testRepoPaths[2])
      .ug.click('.uninited input[type="submit"]')
      .refresh()  // this is currently neccessary as cloning -> repo view transition is not straight forward
                  // and previous test depends on mouse wiggle that triggers refresh.
      .wait('.repository-view')
      .exists('[data-ta-container="remote-error-popup"]')
      .then((isVisible) => { if (isVisible) throw new Error('Should not find remote error popup'); });
  });

  it('Should be possible to fetch', () => {
    return environment.nm.click('.fetchButton .btn-main')
      .wait('.fetchButton .btn-main .progress')
      .ug.waitForElementNotVisible('.fetchButton .btn-main.progress');
  });

  it('Should be possible to create and push a branch', () => {
    return environment.nm.ug.createBranch('branchinclone')
      .ug.refAction('branchinclone', true, 'push')
      .wait('[data-ta-name="origin/branchinclone"]');
  });

  it('Should be possible to force push a branch', () => {
    return environment.nm.ug.moveRef('branchinclone', 'Init Commit 0')
      .ug.refAction('branchinclone', true, 'push')
      .ug.waitForElementNotVisible('[data-ta-action="push"]:not([style*="display: none"])')
  });
});
