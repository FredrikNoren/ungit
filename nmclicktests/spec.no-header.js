'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

describe('[NO-HEADER]', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false }]));
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[0])
      .wait('.repository-view')
      .exists('[data-ta-container="remote-error-popup"]')
      .then((isVisible) => { if (isVisible) throw new Error('Should not find remote error popup'); });
  });

  it('Check for refresh button', () => {
    return environment.nm.wait('.refresh-button')
      .click('.refresh-button')
      .wait(2000)
      .exists('[data-ta-container="remote-error-popup"]')
      .then((isVisible) => { if (isVisible) throw new Error('Should not find remote error popup'); });
  });
});
