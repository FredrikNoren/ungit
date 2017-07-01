'use strict';
const expect = require('expect.js');
const environment = require('./environment')();
const testRepoPaths = [];

describe('test remotes', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false, initCommits: 1 }, { bare: false }]))
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[1]);
  });

  it('Submodule add', () => {
    return environment.nm.ug.click('[data-ta-clickable="submodules-menu"]')
      .ug.click('[data-ta-clickable="add-submodule"]')
      .wait('[data-ta-container="add-submodule"]')
      .insert('[data-ta-container="add-submodule"] [data-ta-input="path"]', 'subrepo')
      .insert('[data-ta-container="add-submodule"] [data-ta-input="url"]', testRepoPaths[0])
      .click('[data-ta-container="add-submodule"] [data-ta-clickable="submit"]')
      .wait(500)
      .click('[data-ta-clickable="submodules-menu"]')
      .wait('[data-ta-container="submodules"] [data-ta-clickable="subrepo"]');
  });

  it('Submodule update', () => {
    return environment.nm.ug.click('[data-ta-clickable="update-submodule"]')
      .wait(500)
      .ug.waitForElementNotVisible('[data-ta-element="progress-bar"]');
  });

  it('Submodule delete check', () => {
    return environment.nm.click('[data-ta-clickable="submodules-menu"]')
      .wait('[data-ta-clickable="subrepo-remove"]')
      .ug.click('[data-ta-clickable="subrepo-remove"]')
      .wait('[data-ta-container="yes-no-dialog"]')
      .ug.click('[data-ta-clickable="yes"]')
      .wait(500)
      .ug.waitForElementNotVisible('[data-ta-element="progress-bar"]')
  });
});
