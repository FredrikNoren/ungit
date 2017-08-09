'use strict';
const muteGraceTimeDuration = 2000;
const createAndDiscard = (env, testRepoPath, dialogButtonToClick) => {
  return env.nm.ug.createTestFile(testRepoPath + '/testfile2.txt')
    .wait('.files .file .btn-default')
    .ug.click('.files span.discard')
    .then(() => {
      if (dialogButtonToClick === "yes") {
        return env.nm.ug.click('.modal-dialog .btn-primary');
      } else if (dialogButtonToClick === "mute") {
        return env.nm.ug.click('.modal-dialog .btn-mute');
      } else if (dialogButtonToClick === "no") {
        return env.nm.ug.click('.modal-dialog .btn-default:last-child');
      } else {
        return env.nm.visible('.modal-dialog .btn-primary')
          .then((isVisible) => { if (isVisible) throw new Error('Should not see yes button'); });
      }
    }).then(() => {
      if (dialogButtonToClick !== 'no') {
        return env.nm.ug.waitForElementNotVisible('.files .file .btn-default');
      } else {
        return env.nm.wait('.files .file .btn-default');
      }
    });
}

describe('[DISCARD - noWarn]', () => {
  const environment = require('./environment')({ serverStartupOptions: ['--disableDiscardWarning'] });
  const testRepoPaths = [];

  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false }]))
  });

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[0]);
  });

  it('Should be possible to discard a created file without warning message', () => {
    return createAndDiscard(environment, testRepoPaths[0]);
  });
});

describe('[DISCARD - withWarn]', () => {
  const environment = require('./environment')({ serverStartupOptions: ['--no-disableDiscardWarning', '--disableDiscardMuteTime=' + muteGraceTimeDuration] });
  const testRepoPaths = [];

  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false }]))
  });

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[0]);
  });

  it('Should be possible to select no from discard', () => {
    return createAndDiscard(environment, testRepoPaths[0], 'no');
  });

  it('Should be possible to discard a created file', () => {
    return createAndDiscard(environment, testRepoPaths[0], 'yes');
  });

  it('Should be possible to discard a created file and disable warn for awhile', () => {
    return createAndDiscard(environment, testRepoPaths[0], 'mute')
      .then(() => createAndDiscard(environment, testRepoPaths[0]))
      .delay(muteGraceTimeDuration + 500)
      .then(() => createAndDiscard(environment, testRepoPaths[0], 'yes'));
  });
});
