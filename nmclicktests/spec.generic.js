'use strict';
const environment = require('./environment')({ serverStartupOptions: ['--no-disableDiscardWarning'], rootPath: '/deep/root/path/to/app' });
const Bluebird = require('bluebird');
const mkdirp = Bluebird.promisifyAll(require("mkdirp")).mkdirPAsync;
const rimraf = Bluebird.promisify(require("rimraf"));
const testRepoPaths = [];

describe('[GENERIC]', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false }]))
      // create a sub dir and change working dir to sub dir to prove functionality within subdir
      .then(() => testRepoPaths.push(`${testRepoPaths[0]}/asubdir`))
      .then(() => rimraf(testRepoPaths[1]))
      .then(() => mkdirp(testRepoPaths[1]));
  });
  after('Environment stop', () => environment.shutdown());

  it('Open repo screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[1]);
  });

  it('Check for refresh button', () => {
    return environment.nm.wait('.refresh-button')
      .ug.click('.refresh-button');
  });

  it('Should be possible to create and commit a file', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.commit('Init')
      .wait('.commit');
  });

  it('Should be possible to amend a file', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.amendCommit()
      .wait('.commit');
  });

  it('Should be able to add a new file to .gitignore', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/addMeToIgnore.txt`)
      .wait('.files .file .btn-default')
      .ug.click('.files span.ignore')
      .ug.click('.files span.ignore')
      .ug.waitForElementNotVisible('.files .file .btn-default');
  });

  it('Test showing commit diff between two commits', () => {
    return environment.nm.wait('[data-ta-clickable="node-clickable-0"]')
      .ug.click('[data-ta-clickable="node-clickable-0"]')
      .wait('.diff-wrapper')
      .ug.click('.commit-diff-filename')
      .wait('.commit-line-diffs');
  });

  it('Test showing commit side by side diff between two commits', () => {
    return environment.nm.ug.click('.commit-sideBySideDiff')
      .wait('.commit-line-diffs');
  });

  it('Test wordwrap', () => {
    return environment.nm.ug.click('.commit-wordwrap')
      .wait('.word-wrap');
  });

  it('Test wordwrap', () => {
    return environment.nm.ug.click('.commit-whitespace')
      .wait('.commit-line-diffs')
      .ug.click('[data-ta-clickable="node-clickable-0"]');
  });

  it('Should be possible to discard a created file and ensure patching is not avaliable for new file', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile2.txt`)
      .wait('.files .file .btn-default')
      .ug.click('.files button')
      .wait('.files .file .btn-default')
      .ug.click('.files button')
      .ug.waitForElementNotVisible('[data-ta-container="patch-file"]')
      .ug.click('.files span.discard')
      .ug.click('.modal-dialog .btn-primary')
      .ug.waitForElementNotVisible('.files .file .btn-default')
  });

  it('Should be possible to create a branch', () => {
    return environment.nm.ug.createBranch('testbranch');
  });

  it('Should be possible to create and destroy a branch', () => {
    return environment.nm.ug.createBranch('willbedeleted')
      .ug.click('.branch[data-ta-name="willbedeleted"]')
      .ug.click('[data-ta-action="delete"]:not([style*="display: none"]) .dropmask')
      .wait('[data-ta-container="yes-no-dialog"]')
      .ug.click('.modal-dialog .btn-primary')
      .ug.waitForElementNotVisible('.branch[data-ta-name="willbedeleted"]');
  });

  it('Should be possible to create and destroy a tag', () => {
    return environment.nm.ug.createTag('tagwillbedeleted')
      .ug.click('.graph .ref.tag[data-ta-name="tagwillbedeleted"]')
      .ug.click('[data-ta-action="delete"]:not([style*="display: none"]) .dropmask')
      .wait('[data-ta-container="yes-no-dialog"]')
      .ug.click('.modal-dialog .btn-primary')
      .ug.waitForElementNotVisible('.graph .ref.tag[data-ta-name="tagwillbedeleted"]');
  });

  it('Commit changes to a file', () => {
    return environment.nm.ug.changeTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .wait('.files .file .btn-default')
      .insert('.staging input.form-control', 'My commit message')
      .click('.commit-btn')
      .ug.waitForElementNotVisible('.files .file .btn-default');
  });

  it('Show stats for changed file and discard it', () => {
    return environment.nm.ug.changeTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .wait('.files .file .additions')
      .wait('.files .file .deletions')
      .ug.click('.files span.discard')
      .ug.click('.modal-dialog .btn-primary')
      .ug.waitForElementNotVisible('.files .file .btn-default');
  });

  it.skip('Should be possible to patch a file', () => {
    return environment.nm.ug.changeTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .patch('patch')
      .waitForElementVisible('.commit');
  });

  it('Checkout a branch', () => {
    return environment.nm.ug.checkout('testbranch');
  });

  it('Create another commit', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testy2.txt`)
      .ug.commit('Branch commit');
  });

  it('Rebase', () => {
    return environment.nm.ug.refAction('testbranch', true, 'rebase');
  });

  it('Checkout master again', () => {
    return environment.nm.ug.checkout('master');
  });

  it('Create yet another commit', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testy3.txt`)
      .ug.commit('Branch commit');
  });

  it('Merge', () => {
    return environment.nm.ug.refAction('testbranch', true, 'merge');
  });

  it('Revert merge', () => {
    return environment.nm.ug.click('[data-ta-clickable="node-clickable-0"]')
      .wait('[data-ta-action="revert"]')
      .ug.click('[data-ta-action="revert"]')
      .ug.waitForElementNotVisible('.crash');
  });

  it('Should be possible to move a branch', () => {
    return environment.nm.ug.createBranch('movebranch')
      .ug.moveRef('movebranch', 'Init');
  });

  it('Should be possible to click refresh button', () => {
    return environment.nm.ug.click('button.refresh-button');
  });

  it('Go to home screen', () => {
    return environment.nm.ug.click('.navbar .backlink')
      .wait('.home');
  });
});
