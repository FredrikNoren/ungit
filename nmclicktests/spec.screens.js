'use strict';
const environment = require('./environment')();
const Bluebird = require('bluebird');
const mkdirp = Bluebird.promisifyAll(require("mkdirp")).mkdirPAsync;
const rimraf = Bluebird.promisify(require("rimraf"));
const testRepoPaths = [];

describe('[SCREENS]', () => {
  before('Environment init', () => environment.init());

  after('Environment stop', () => environment.shutdown());

  it('Open home screen', () => {
    return environment.nm.goto(environment.getRootUrl())
      .wait('.home');
  });

  it('Open path screen', () => {
    return environment.nm.ug.createTempFolder().then(res => {
        testRepoPaths.push(res.path ? res.path : res)
        return environment.nm.goto(`${environment.getRootUrl()}/#/repository?path=${encodeURIComponent(testRepoPaths[0])}`)
          .wait('.uninited');
      });
  });

  it('Init repository should bring you to repo page', () =>  {
    return environment.nm.ug.click('.uninited button.btn-primary')
      .wait('.repository-view')
      .exists('[data-ta-container="remote-error-popup"]')
      .then((isVisible) => { if (isVisible) throw new Error('Should not find remote error popup'); });
  });

  it('Clicking logo should bring you to home screen', () =>  {
    return environment.nm.ug.click('.navbar .backlink')
      .wait('.home')
  });

  it('Entering an invalid path and create directory in that location', () =>  {
    return environment.nm.insert('.navbar .path-input-form input')
      .insert('.navbar .path-input-form input', `${testRepoPaths[0]}-test0/not/existing`)
      .type('.navbar .path-input-form input', '\u000d')
      .wait('.invalid-path')
      .ug.click('.invalid-path button')
      .wait('.uninited button.btn-primary');
  });

  it('Entering an invalid path should bring you to an error screen', () =>  {
    return environment.nm.insert('.navbar .path-input-form input')
      .insert('.navbar .path-input-form input', '/a/path/that/doesnt/exist')
      .type('.navbar .path-input-form input', '\u000d')
      .wait('.invalid-path');
  });

  it('Entering a path to a repo should bring you to that repo', () =>  {
    return environment.nm.insert('.navbar .path-input-form input')
      .insert('.navbar .path-input-form input', testRepoPaths[0])
      .type('.navbar .path-input-form input', '\u000d')
      .wait('.repository-view');
  });

  // getting odd cross-domain-error.
  it('Create test directory with ampersand and open it', () =>  {
    var specialRepoPath = `${testRepoPaths[0]}-test1/test & repo`;
    return rimraf(specialRepoPath)
      .then(() => mkdirp(specialRepoPath))
      .then(() => {
        return environment.nm.wait(2000)
          .goto(`${environment.getRootUrl()}/#/repository?path=${encodeURIComponent(specialRepoPath)}`)
          .wait('.uninited')
      });
  });
});
