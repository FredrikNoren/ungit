'use strict';

const logger = require('../source/utils/logger');

const muteGraceTimeDuration = 3000;
const createAndDiscard = async (env, testRepoPath, dialogButtonToClick) => {
  logger.info(`creating "${testRepoPath}" with "${dialogButtonToClick}"`);
  await env.createTestFile(testRepoPath + '/testfile2.txt', testRepoPath);
  await env.waitForElementVisible('.files .file .btn-default');

  logger.info('click discard button');
  await env.click('.files button.discard');

  if (dialogButtonToClick === 'yes') {
    await env.click('.modal-dialog [data-ta-action="yes"]');
  } else if (dialogButtonToClick === 'mute') {
    await env.click('.modal-dialog [data-ta-action="mute"]');
  } else if (dialogButtonToClick === 'no') {
    await env.click('.modal-dialog [data-ta-action="no"]');
  } else {
    await env.waitForElementHidden('.modal-dialog [data-ta-action="yes"]');
  }

  logger.info('waiting for the button to disappear');

  if (dialogButtonToClick !== 'no') {
    await env.waitForElementHidden('.files .file .btn-default', 100000);
  } else {
    await env.waitForElementVisible('.files .file .btn-default');
  }
};

describe('[DISCARD - noWarn]', () => {
  const environment = require('./environment')({
    serverStartupOptions: ['--disableDiscardWarning'],
  });
  const testRepoPaths = [];

  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: false }]);
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.openUngit(testRepoPaths[0]);
  });

  it('Should be possible to discard a created file without warning message', () => {
    return createAndDiscard(environment, testRepoPaths[0]);
  });
});

describe('[DISCARD - withWarn]', () => {
  const environment = require('./environment')({
    serverStartupOptions: [
      '--no-disableDiscardWarning',
      '--disableDiscardMuteTime=' + muteGraceTimeDuration,
    ],
  });
  const testRepoPaths = [];

  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: false }]);
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.openUngit(testRepoPaths[0]);
  });

  it('Should be possible to select no from discard', () => {
    return createAndDiscard(environment, testRepoPaths[0], 'no');
  });

  it('Should be possible to discard a created file', () => {
    return createAndDiscard(environment, testRepoPaths[0], 'yes');
  });

  it('Should be possible to discard a created file and disable warn for awhile', async function () {
    await createAndDiscard(environment, testRepoPaths[0], 'mute');
    await environment.triggerProgramEvents();
    await environment.wait(1000);
    await createAndDiscard(environment, testRepoPaths[0]);
    await environment.triggerProgramEvents();
    await environment.wait(1000);
    await createAndDiscard(environment, testRepoPaths[0], 'yes');
  });
});
