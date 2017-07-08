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
      .wait('[data-ta-container="home-page"]');
  });

  it('Open path screen', () => {
    return environment.nm.ug.createTempFolder().then(res => {
        testRepoPaths.push(res.path ? res.path : res)
        return environment.nm.goto(`${environment.getRootUrl()}/#/repository?path=${encodeURIComponent(testRepoPaths[0])}`)
          .wait('[data-ta-container="uninited-path-page"]');
      });
  });

  it('Init repository should bring you to repo page', () =>  {
    return environment.nm.ug.click('[data-ta-clickable="init-repository"]')
      .wait('[data-ta-container="repository-view"]')
      .exists('[data-ta-container="remote-error-popup"]')
      .then((isVisible) => { if (isVisible) throw new Error('Should not find remote error popup'); });
  });

  it('Clicking logo should bring you to home screen', () =>  {
    return environment.nm.ug.click('[data-ta-clickable="home-link"]')
      .wait('[data-ta-container="home-page"]')
  });

  it('Entering an invalid path and create directory in that location', () =>  {
    return environment.nm.insert('[data-ta-input="navigation-path"]')
      .insert('[data-ta-input="navigation-path"]', `${testRepoPaths[0]}-test0/not/existing`)
      .type('[data-ta-input="navigation-path"]', '\u000d')
      .wait('[data-ta-container="invalid-path"]')
      .ug.click('[data-ta-clickable="create-dir"]')
      .wait('[data-ta-clickable="init-repository"]');
  });

  it('Entering an invalid path should bring you to an error screen', () =>  {
    return environment.nm.insert('[data-ta-input="navigation-path"]')
      .insert('[data-ta-input="navigation-path"]', '/a/path/that/doesnt/exist')
      .type('[data-ta-input="navigation-path"]', '\u000d')
      .wait('[data-ta-container="invalid-path"]');
  });

  it('Entering a path to a repo should bring you to that repo', () =>  {
    return environment.nm.insert('[data-ta-input="navigation-path"]')
      .insert('[data-ta-input="navigation-path"]', testRepoPaths[0])
      .type('[data-ta-input="navigation-path"]', '\u000d')
      .wait('[data-ta-container="repository-view"]');
  });

  // getting odd cross-domain-error.
  it('Create test directory with ampersand and open it', () =>  {
    var specialRepoPath = `${testRepoPaths[0]}-test1/test & repo`;
    return rimraf(specialRepoPath)
      .then(() => mkdirp(specialRepoPath))
      .then(() => {
        return environment.nm.wait(2000)
          .goto(`${environment.getRootUrl()}/#/repository?path=${encodeURIComponent(specialRepoPath)}`)
          .wait('[data-ta-container="uninited-path-page"]')
      });
  });
});
