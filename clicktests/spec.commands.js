'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

const gitCommand = (options) => {
  return environment.backgroundAction('POST', '/api/testing/git', options);
};
const testForBranchMove = async (branch, command) => {
  const branchTagLoc = await environment.page.$eval(branch, (element) =>
    JSON.stringify(element.getBoundingClientRect())
  );

  await gitCommand({ command: command, path: testRepoPaths[0] });

  await environment.page.waitForFunction(
    (branch, oldLoc) => {
      const newLoc = document.querySelector(branch).getBoundingClientRect();
      return newLoc.top !== oldLoc.top || newLoc.left !== oldLoc.left;
    },
    {},
    branch,
    JSON.parse(branchTagLoc)
  );
};

describe('[COMMANDS]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: false }]);
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.openUngit(testRepoPaths[0]);
  });

  it('add a branch-1', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/testfile.txt`, testRepoPaths[0]);
    await environment.commit('commit-1');
    await environment.createBranch('branch-1');
  });

  it('add a branch-2', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/testfile.txt`, testRepoPaths[0]);
    await environment.commit('commit-1');
    await environment.createBranch('branch-2');
  });

  it('test branch create from command line', async () => {
    await gitCommand({ command: ['branch', 'gitCommandBranch'], path: testRepoPaths[0] });
    await environment.waitForElementVisible('[data-ta-name="gitCommandBranch"]');
  });

  it('test branch move from command line', () => {
    return testForBranchMove('[data-ta-name="gitCommandBranch"]', [
      'branch',
      '-f',
      'gitCommandBranch',
      'branch-1',
    ]);
  });

  it('test branch delete from command line', async () => {
    await gitCommand({ command: ['branch', '-D', 'gitCommandBranch'], path: testRepoPaths[0] });
    await environment.waitForElementHidden('[data-ta-name="gitCommandBranch"]');
  });

  it('test tag create from command line', async () => {
    await gitCommand({ command: ['tag', 'tag1'], path: testRepoPaths[0] });
    await environment.waitForElementVisible('[data-ta-name="tag1"]');
  });

  it('test tag delete from command line', async () => {
    await gitCommand({ command: ['tag', '-d', 'tag1'], path: testRepoPaths[0] });
    await environment.waitForElementHidden('[data-ta-name="tag1"]');
  });

  it('test reset from command line', () => {
    return testForBranchMove('[data-ta-name="branch-1"]', ['reset', 'branch-1']);
  });
});
