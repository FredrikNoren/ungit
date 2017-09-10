const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const restGit = require('../src/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

const req = request(app);

describe('git-api: test ignorefile call', () => {

  after(() => common.post(req, '/testing/cleanup'));

  it('Add a file to .gitignore file through api call', () => {
    return common.createSmallRepo(req).then(dir => {
      const testFile = 'test.txt';

      // Create .gitignore file prior to append
      fs.writeFileSync(path.join(dir, '.gitignore'), 'test git ignore file...');
      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile) })
        .then(() => common.post(req, '/ignorefile', { path: dir, file: testFile }))
        .then(() => {
          return common.get(req, '/status', { path: dir }).then(res => {
            expect(Object.keys(res.files).toString()).to.be('.gitignore');
          });
        }).then(() => {
          return fs.readFileAsync(path.join(dir, '.gitignore')).then(data => {
            if (data.toString().indexOf(testFile) < 0) {
              throw new Error('Test file is not added to the .gitignore file.');
            }
          });
        })
      });
  });

  it('Add a file to .gitignore file through api call when .gitignore is missing', () => {
    return common.createSmallRepo(req).then(dir => {
      const testFile = 'test.txt';

      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile) })
        .then(() => common.post(req, '/ignorefile', { path: dir, file: testFile }))
        .then(() => {
          return common.get(req, '/status', { path: dir }).then(res => {
            expect(Object.keys(res.files).toString()).to.be('.gitignore');
          });
        }).then(() => {
          return fs.readFileAsync(path.join(dir, '.gitignore')).then((data) => {
            if (data.toString().indexOf(testFile) < 0) {
              throw new Error('Test file is not added to the .gitignore file.');
            }
          });
        })
    });
  });

  it('Attempt to add a file where similar name alread exist in .gitignore through api call', () => {
    return common.createSmallRepo(req).then(dir => {
      const testFile = 'test.txt';

      // add part of file name to gitignore
      fs.appendFileSync(path.join(dir, '.gitignore'), testFile.split('.')[0]);


      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile) })
        .then(() => common.post(req, '/ignorefile', { path: dir, file: testFile }))
        .then(() => {
          return common.get(req, '/status', { path: dir }).then(res => {
            expect(Object.keys(res.files).toString()).to.be('.gitignore');
          });
        }).then(() => {
          return fs.readFileAsync(path.join(dir, '.gitignore')).then((data) => {
            if (data.toString().indexOf(testFile) < 0) {
              throw new Error('Test file is not added to the .gitignore file.');
            }
          });
        })
    });
  });
});
