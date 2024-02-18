'use strict';
const environment = require('./environment')();
const testRepoPaths = [];
const _ = require('lodash');

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
    { timeout: 6000, polling: 250 },
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
    const brachesResponseProm = environment.setApiListener('/branches?', 'GET', (body) => {
      return _.isEqual(body, [
        { name: 'branch-1' },
        { name: 'branch-2' },
        { name: 'master', current: true },
      ]);
    });
    await gitCommand({ command: ['branch', '-D', 'gitCommandBranch'], path: testRepoPaths[0] });
    await brachesResponseProm;
    await environment.waitForElementHidden('[data-ta-name="gitCommandBranch"]', 10000);
  });

  it('test tag create from command line', async () => {
    const refsResponseProm = environment.setApiListener('/refs?', 'GET', (body) => {
      body.forEach((ref) => delete ref.sha1);
      return _.isEqual(body, [
        { name: 'refs/heads/branch-1' },
        { name: 'refs/heads/branch-2' },
        { name: 'refs/heads/master' },
        { name: 'refs/tags/tag1' },
      ]);
    });
    await gitCommand({ command: ['tag', 'tag1'], path: testRepoPaths[0] });
    await refsResponseProm;
    await environment.waitForElementVisible('[data-ta-name="tag1"]', 10000);
  });

  it('test tag delete from command line', async () => {
    const refDeleteResponseProm = environment.setApiListener('/refs?', 'GET', (body) => {
      body.forEach((ref) => delete ref.sha1);
      return _.isEqual(body, [
        { name: 'refs/heads/branch-1' },
        { name: 'refs/heads/branch-2' },
        { name: 'refs/heads/master' },
      ]);
    });
    await gitCommand({ command: ['tag', '-d', 'tag1'], path: testRepoPaths[0] });
    await refDeleteResponseProm;
    await environment.waitForElementHidden('[data-ta-name="tag1"]', 10000);
  });

  it('test reset from command line', () => {
    return testForBranchMove('[data-ta-name="branch-1"]', ['reset', 'branch-1']);
  });
});
