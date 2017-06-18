'use strict';
const expect = require('expect.js');
const environment = require('./environment')();
const testRepoPaths = [];

describe('test bare repo', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: true }]));
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[0]);
  });

  it('update branches button without branches', () => {
    return environment.nm.ug.click('[data-ta-clickable="branch"]')
      .ug.waitForElementNotVisible('[data-ta-clickable="branch"] [data-ta-element="progress-bar"]');
  });
});
