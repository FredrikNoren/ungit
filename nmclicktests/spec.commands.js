'use strict';
const environment = require('./environment')();
const testRepoPaths = [];

const testForBranchMove = (branch, command) => {
  let branchTagLoc;
  return environment.nm.evaluate((branch) => document.querySelector(branch).getBoundingClientRect(), branch)
    .then((oldLoc) => {
      branchTagLoc = oldLoc;
      return environment.nm.ug.gitCommand({ command: command, repo: testRepoPaths[0] })
        .wait((branch, oldLoc) => {
          let newLoc = document.querySelector(branch).getBoundingClientRect();
          return newLoc.top !== oldLoc.top || newLoc.left !== oldLoc.left;
        }, branch, branchTagLoc);
    });
}

describe('[COMMANDS]', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos(testRepoPaths, [{ bare: false }]));
  });
  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => {
    return environment.nm.ug.openUngit(testRepoPaths[0]);
  });

  it('add a branch-1', () => {
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.commit('commit-1')
      .wait('.commit')
      .ug.createBranch('branch-1');
  });

  it('add a branch-2', () =>{
    return environment.nm.ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.commit('commit-1')
      .wait('.commit')
      .ug.createBranch('branch-2');
  });

  it('test branch create from command line', () => {
    return environment.nm.ug.gitCommand({ command: ["branch", "gitCommandBranch"], repo: testRepoPaths[0] })
      .then(() => environment.nm.wait('[data-ta-name="gitCommandBranch"]'));
  });

  it('test branch move from command line', () => {
    return testForBranchMove('[data-ta-name="gitCommandBranch"]', ["branch", "-f", "gitCommandBranch", "branch-1"]);
  });

  it('test branch delete from command line', () => {
    return environment.nm.ug.gitCommand({ command: ["branch", "-D", "gitCommandBranch"], repo: testRepoPaths[0] })
      .ug.waitForElementNotVisible('[data-ta-name="gitCommandBranch');
  });

  it('test tag create from command line', () => {
    return environment.nm.ug.gitCommand({ command: ["tag", "tag1"], repo: testRepoPaths[0] })
      .wait('[data-ta-name="tag1"]')
  });

  it('test tag delete from command line', () => {
    return environment.nm.ug.gitCommand({ command: ["tag", "-d", "tag1"], repo: testRepoPaths[0] })
      .ug.waitForElementNotVisible('[data-ta-name="tag1"]');
  });

  it('test reset from command line', () => {
    return testForBranchMove('[data-ta-name="branch-1"]', ["reset", "branch-1"]);
  });
});
