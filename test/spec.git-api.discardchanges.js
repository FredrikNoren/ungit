
const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../src/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

const req = request(app);

describe('git-api discardchanges', () => {
  after(() => common.post(req, '/testing/cleanup'));

  it('should be able to discard a new file', () => {
    return common.createSmallRepo(req).then((dir) => {
      const testFile1 = 'test.txt';
      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) })
        .then(() => common.post(req, '/discardchanges', { path: dir, file: testFile1 }))
        .then(() => common.get(req, '/status', { path: dir }))
        .then((res) => expect(Object.keys(res.files).length).to.be(0));
    });
  });

  it('should be able to discard a changed file', () => {
    return common.createSmallRepo(req).then((dir) => {
      const testFile1 = 'test.txt';

      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) })
        .then(() => common.post(req, '/commit', { path: dir, message: 'lol', files: [{ name: testFile1 }] }))
        .then(() => common.post(req, '/testing/changefile', { file: path.join(dir, testFile1) }))
        .then(() => common.post(req, '/discardchanges', { path: dir, file: testFile1 }))
        .then(() => common.get(req, '/status', { path: dir }))
        .then((res) => expect(Object.keys(res.files).length).to.be(0));
    });
  });

  it('should be able to discard a removed file', () => {
    return common.createSmallRepo(req).then((dir) => {
      const testFile1 = 'test.txt';

      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) })
        .then(() => common.post(req, '/commit', { path: dir, message: 'lol', files: [{ name: testFile1 }] }))
        .then(() => common.post(req, '/testing/removefile', { file: path.join(dir, testFile1) }))
        .then(() => common.post(req, '/discardchanges', { path: dir, file: testFile1 }))
        .then(() => common.get(req, '/status', { path: dir }))
        .then((res) => expect(Object.keys(res.files).length).to.be(0));
    });
  });

  it('should be able to discard a new and staged file', () => {
    return common.createSmallRepo(req).then((dir) => {
      const testFile1 = 'test.txt';

      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) })
        .then(() => common.post(req, '/testing/git', { repo: dir, command: ['add', testFile1] }))
        .then(() => common.post(req, '/discardchanges', { path: dir, file: testFile1 }))
        .then(() => common.get(req, '/status', { path: dir }))
        .then((res) => expect(Object.keys(res.files).length).to.be(0));
    });
  });

  it('should be able to discard a staged and removed file', () => {
    return common.createSmallRepo(req).then((dir) => {
      const testFile1 = 'test.txt';

      return common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) })
        .then(() => common.post(req, '/testing/git', { repo: dir, command: ['add', testFile1] }))
        .then(() => common.post(req, '/testing/removefile', { file: path.join(dir, testFile1) }))
        .then(() => common.post(req, '/discardchanges', { path: dir, file: testFile1 }))
        .then(() => common.get(req, '/status', { path: dir }))
        .then((res) => expect(Object.keys(res.files).length).to.be(0));
    });
  });

  it('should be able to discard discard submodule changes', () => {
    const testFile = 'smalltestfile.txt';
    const submodulePath = 'subrepo';

    return common.createSmallRepo(req).then((dir) => {
        return common.createSmallRepo(req).then((subrepoDir) => {
            return common.post(req, '/submodules/add', {
                "submoduleUrl": subrepoDir,
                "submodulePath": submodulePath,
                "path": dir,
              }).then(() => dir)
          });
      }).then((dir) => {
        return common.post(req, '/commit', { path: dir, message: 'lol', files: [{ name: '.gitmodules' }] })
          .then(() => common.post(req, '/testing/changefile', { file: path.join(dir, submodulePath, testFile) }))
          .then(() => common.post(req, '/discardchanges', { path: dir, file: submodulePath }))
          .then(() => common.get(req, '/status', { path: dir }))
          .then((res) => expect(Object.keys(res.files).length).to.be(0))
      });
  });

  // Need to make discardchanges even more powerful to handle this
  /*it('should be able to discard a commited, staged and removed file', () => {
    common.createSmallRepo(req, function(dir) {
      if (err) return done(err);
      const testFile1 = 'test.txt';

        () => {common.post(req, '/testing/createfile', { file: path.join(dir, testFile1) });
        () => {common.post(req, '/commit', { path: dir, message: 'lol', files: [{ name: testFile1 }] });
        () => {common.post(req, '/testing/changefile', { file: path.join(dir, testFile1) });
        () => {common.post(req, '/testing/git', { repo: dir, command: ['add', testFile1] });
        () => {common.post(req, '/testing/removefile', { file: path.join(dir, testFile1) });
        () => {common.post(req, '/discardchanges', { path: dir, file: testFile1 });
        () => {common.get(req, '/status', { path: dir }).then((res) => {
          if (err) return done(err);
          expect(Object.keys(res.files).length).to.be(0);
          done();
        }); },
      ], done);
    });
  });*/
});
