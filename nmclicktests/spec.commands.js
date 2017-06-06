'use strict';
const expect = require('expect.js');
const environment = require('./environment')();

let testRepoPaths;

describe('test commands', () => {
  before('Environment init', () => {
    return environment.init()
      .then(() => environment.createRepos([{ bare: false }]))
      .then((repos) => testRepoPaths = repos);
  });

  it('Open path screen', () => {
    return environment.nightmare.ug.openUngit(testRepoPaths[0]);
  });

  it('add a branch-1', () => {
    return environment.nightmare
      .ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.commit('commit-1')
      .wait('.commit')
      .ug.createBranch('branch-1');
  });

  it('add a branch-2', () =>{
    return environment.nightmare
      .ug.createTestFile(`${testRepoPaths[0]}/testfile.txt`)
      .ug.commit('commit-1')
      .wait('.commit')
      .ug.createBranch('branch-2');
  });

  it('test branch create from command line', () => {
    return environment.nightmare
      .ug.gitCommand({ command: ["branch", "gitCommandBranch"], repo: testRepoPaths[0] })
      .then((cc) => {
        console.log(1111111, cc)
        return environment.nightmare.wait('[data-ta-name="gitCommandBranch"]')
      })

  });

  it('test branch move from command line', () => {
    let branchTagLoc;
    return environment.nightmare
      .evaluate(function() {
        const oldLoc = document.querySelector('[data-ta-name="gitCommandBranch"]').getBoundingClientRect();
        console.log(`current gitCommandBranch coordinate: ${oldLoc}`)
        return oldLoc;
      }).then((oldLoc) => {
        branchTagLoc = oldLoc;
        console.log(4123123123, branchTagLoc)
        return environment.nightmare.ug.gitCommand({ command: ["branch", "-f", "gitCommandBranch", "branch-1"], repo: testRepoPaths[0] })
      })
      .wait(function (oldLoc) {
        let newLoc = document.querySelector('[data-ta-name="gitCommandBranch"]').getBoundingClientRect();
        console.log(`current gitCommandBranch coordinate: ${oldLoc}`)
        console.log(`new gitCommandBranch coordinate: ${newLoc}`);
        console.log(999, newLoc.top)
        console.log(234, oldLoc.top)
        console.log(222, newLoc.left, oldLoc.left);
        return newLoc.top !== oldLoc.top || newLoc.left !== oldLoc.left;
      }, branchTagLoc);
  });

  it('test branch delete from command line', () => {
    return environment.nightmare
      .ug.gitCommand({ command: ["branch", "-D", "gitCommandBranch"], repo: testRepoPaths[0] })
      .ug.waitForElementNotVisible('[data-ta-name="gitCommandBranch');
  });

  it('test tag create from command line', () => {
    return environment.nightmare
      .ug.gitCommand({ command: ["tag", "tag1"], repo: testRepoPaths[0] })
      .wait('[data-ta-name="tag1"]')
  });

  it('test tag delete from command line', () => {
    return environment.nightmare
      .ug.gitCommand({ command: ["tag", "-d", "tag1"], repo: testRepoPaths[0] })
      .ug.waitForElementNotVisible('[data-ta-name="tag1"]');
  });

  it('test reset from command line', () => {
    return environment.nightmare
      .ug.gitCommand({ command: ["reset", "branch-1"], repo: testRepoPaths[0] })
      .wait('fix selector for branch move')
  });
});
