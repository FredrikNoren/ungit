'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

describe('[SUMBODULES]', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false, initCommits: 1 }, { bare: false }]))
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[1]);
  });

  it('Submodule add', () => {
    return environment.nm.ug.click('.submodule .dropdown-toggle')
      .ug.click('.fetchButton .add-submodule')
      .wait('.modal')
      .insert('.modal #Path', 'subrepo')
      .insert('.modal #Url', testRepoPaths[0])
      .click('.modal .modal-footer input')
      .wait(500)
      .click('.submodule .dropdown-toggle')
      .wait('.fetchButton .dropdown-menu [data-ta-clickable="subrepo"]');
  });

  it('Submodule update', () => {
    return environment.nm.ug.click('.fetchButton .update-submodule')
      .wait(500)
      .ug.waitForElementNotVisible('.progress');
  });

  it('Submodule delete check', () => {
    return environment.nm.click('.submodule .dropdown-toggle')
      .wait('[data-ta-clickable="subrepo-remove"]')
      .ug.click('[data-ta-clickable="subrepo-remove"]')
      .wait('[data-ta-container="yes-no-dialog"]')
      .ug.click('.modal-dialog .btn-primary')
      .wait(500)
      .ug.waitForElementNotVisible('.progress')
  });
});
