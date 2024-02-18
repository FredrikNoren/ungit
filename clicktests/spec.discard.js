'use strict';

const muteGraceTimeDuration = 5000;
const createAndDiscard = async (env, testRepoPath, dialogButtonToClick) => {
  await env.createTestFile(testRepoPath + '/testfile2.txt', testRepoPath);
  await env.ensureRedraw();
  await env.waitForElementVisible('.files .file .btn-default');

  await env.click('.files button.discard');
  if (dialogButtonToClick === 'yes') {
    await env.awaitAndClick('.modal-dialog [data-ta-action="yes"]');
  } else if (dialogButtonToClick === 'mute') {
    await env.awaitAndClick('.modal-dialog [data-ta-action="mute"]');
  } else if (dialogButtonToClick === 'no') {
    await env.awaitAndClick('.modal-dialog [data-ta-action="no"]');
  } else {
    await env.waitForElementHidden('.modal-dialog [data-ta-action="yes"]');
  }
  if (dialogButtonToClick !== 'no') {
    await env.ensureRedraw();
    await env.waitForElementHidden('.files .file .btn-default');
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

  it('Should be possible to discard a created file and disable warn for awhile', async () => {
    await createAndDiscard(environment, testRepoPaths[0], 'mute');
    const start = new Date().getTime(); // this is when the "mute" timestamp is stamped
    await createAndDiscard(environment, testRepoPaths[0]);
    // ensure, at least 2 seconds has passed since mute timestamp is stamped
    const end = new Date().getTime();
    const diff = muteGraceTimeDuration + 500 - (end - start);
    if (diff > 0) {
      await environment.wait(diff);
    }
    await createAndDiscard(environment, testRepoPaths[0], 'yes');
  });
});
