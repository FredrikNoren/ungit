const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../src/git-api');
const common = require('./common-es6.js');
const md5 = require('blueimp-md5');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

let testDir;
const req = request(app);

const testPatch = (req, testDir, testFileName, contentsToPatch, files) => {
  // testDir = '/tmp/testdir';
  return common.post(req, '/testing/createfile', { file: path.join(testDir, testFileName), content: contentsToPatch[0] })
    .then(() => common.post(req, '/commit', { path: testDir, message: `a commit for ${testFileName}`, files: [{ name: testFileName }] }))
    .then(() => common.post(req, '/testing/changefile', { file: path.join(testDir, testFileName), content: contentsToPatch[1] }))
    .then(() => common.post(req, '/commit', { path: testDir, message: `patched commit ${testFileName}`, files: files }));
}

const getPatchLineList = (size, notSelected) => {
  let patchLineList = [];
  for (let n = 0; n < size; n++) {
    patchLineList.push(false);
  }

  if (notSelected) {
    for (let m = 0; m < notSelected.length; m++) {
      patchLineList[notSelected[m]] = true;
    }
  }
  return patchLineList;
}

const getContentsToPatch = (size, toChange) => {
  let content = '';
  let changedContent = '';

  for (let n = 0; n < size; n++) {
    content += (n + '\n');
    changedContent += n;
    if (!toChange || toChange.indexOf(n) > -1) {
      changedContent += '!';
    }
    changedContent += '\n';
  }

  return [content, changedContent];
}

const getContentsToPatchWithAdd = (size, numLinesToAdd) => {
  let content = '';
  let changedContent = '';
  let n = 0;

  while (n < size) {
    content += (n + '\n');
    changedContent += (n + '\n');
    n++;
  }
  while (n < size + numLinesToAdd) {
    changedContent += (n + '\n');
    n++;
  }

  return [content, changedContent];
}

const getContentsToPatchWithDelete = (size, numLinesToDelete) => {
  let content = '';
  let changedContent = '';
  let n = 0;

  while (n < size) {
    content += (n + '\n');
    if (n  < size - numLinesToDelete) {
      changedContent += (n + '\n');
    }
    n++;
  }

  return [content, changedContent];
}

describe('git-api: test patch api', () => {
  it('creating test dir should work', () => {
    return common.post(req, '/testing/createtempdir')
      .then((res) => {
        expect(res.path).to.be.ok();
        testDir = res.path;
      })
  });

  it('init test dir should work', () => {
    return common.post(req, '/init', { path: testDir, bare: false });
  });


  ///////////////////////////////////////////////////////
  // Single diff block diff, (git apply uses diff -U3) //
  ///////////////////////////////////////////////////////

  it('Create a file with 10 lines, commit, change each 10 lines, and commit patch with all selected.', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 10;
    const contentsToPatch = getContentsToPatch(testFileSize);
    let patchLineList = [];

    for (let n = 0; n < testFileSize * 2; n++) {
      patchLineList.push(true);
    }

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('Create a file with 10 lines, commit, change each 10 lines, and commit patch with none selected.', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 10;
    const patchLineList = getPatchLineList(testFileSize * 2);
    const contentsToPatch = getContentsToPatch(testFileSize);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('10 lines, 10 edit, 0~2 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 10;
    const patchLineList = getPatchLineList(testFileSize * 2, [0, 1, 2]);
    const contentsToPatch = getContentsToPatch(testFileSize);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('10 lines, 10 edit, 18~19 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 10;
    const patchLineList = getPatchLineList(testFileSize * 2, [18, 19]);
    const contentsToPatch = getContentsToPatch(testFileSize);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('10 lines, 10 edit, 0~2 and 18~19 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 10;
    const patchLineList = getPatchLineList(testFileSize * 2, [0, 1, 2, 18, 19]);
    const contentsToPatch = getContentsToPatch(testFileSize);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('10 lines, 10 edit, 5~7 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 10;
    const patchLineList = getPatchLineList(testFileSize * 2, [5, 6, 7]);
    const contentsToPatch = getContentsToPatch(testFileSize);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('30 lines, 30 edit, 0~2 and 28 ~ 29 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 30;
    const patchLineList = getPatchLineList(testFileSize * 2, [0, 1, 2, 28, 29]);
    const contentsToPatch = getContentsToPatch(testFileSize);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('30 lines, 30 edit, 0~2, 28~29, 58~59 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 30;
    const patchLineList = getPatchLineList(testFileSize * 2, [0, 1, 2, 28, 29, 57, 58, 59]);
    const contentsToPatch = getContentsToPatch(testFileSize);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('30 lines, 30 edit, 6~8, 16~18 and 58 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 30;
    const patchLineList = getPatchLineList(testFileSize * 2, [6, 7, 8, 16, 17, 18, 58]);
    const contentsToPatch = getContentsToPatch(testFileSize);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('30 lines, 30 edit, 12~15 and 17~19 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 30;
    const patchLineList = getPatchLineList(testFileSize * 2, [12, 13, 14, 15, 17, 18, 19]);
    const contentsToPatch = getContentsToPatch(testFileSize);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('30 lines, 12~19 edit, 0~7, 10~16 selected ', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 30;
    const linesToChange = [12, 13, 14, 15, 16, 17, 18, 19];
    const contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    const patchLineList = getPatchLineList(linesToChange.length * 2, [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16]);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  //////////////////////////////////////////////////////
  // Multi diff block diff, (git apply uses diff -U3) //
  //////////////////////////////////////////////////////

  it('30 lines, 2~4, 12~14, 22~24 edit, all selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 30;
    const linesToChange = [2, 3, 4, 12, 13, 14, 22, 23, 24];
    const contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    const patchLineList = getPatchLineList(linesToChange.length * 2, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('30 lines, 2~4, 12~14, 22~24 edit, 0~5, 12~17 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 30;
    const linesToChange = [2, 3, 4, 12, 13, 14, 22, 23, 24];
    const contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    const patchLineList = getPatchLineList(linesToChange.length * 2, [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17]);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('30 lines, 2~4, 12~14, 22~24 edit, 6~11 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 30;
    const linesToChange = [2, 3, 4, 12, 13, 14, 22, 23, 24];
    const contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    const patchLineList = getPatchLineList(linesToChange.length * 2, [6, 7, 8, 9, 10, 11]);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('30 lines, 2~4, 12~14, 22~24 edit, none selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 30;
    const linesToChange = [2, 3, 4, 12, 13, 14, 22, 23, 24];
    const contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    const patchLineList = getPatchLineList(linesToChange.length * 2);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  it('30 lines, 12~14, 16~18 edit, 6~11 selected', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 30;
    const linesToChange = [12, 13, 14, 22, 23, 24];
    const contentsToPatch = getContentsToPatch(testFileSize, linesToChange);
    const patchLineList = getPatchLineList(linesToChange.length * 2, [6, 7, 8, 9, 10, 11]);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  // added diff only, (git apply uses diff -U3)
  it('10 lines, add 5 lines, select 0~1, 5', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 10;
    const linesToAdd = 5;
    const contentsToPatch = getContentsToPatchWithAdd(testFileSize, linesToAdd);
    const patchLineList = getPatchLineList(linesToAdd, [0, 1, 5]);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });

  // deleted diff only, (git apply uses diff -U3)
  it('10 lines, delete 5 lines, select 0~1, 5', () => {
    const testFileName = md5(Date.now());
    const testFileSize = 10;
    const linesToDelete = 5;
    const contentsToPatch = getContentsToPatchWithDelete(testFileSize, linesToDelete);
    const patchLineList = getPatchLineList(linesToDelete, [0, 1, 5]);

    return testPatch(req, testDir, testFileName, contentsToPatch, [{ name: testFileName, patchLineList: patchLineList }]);
  });
});
