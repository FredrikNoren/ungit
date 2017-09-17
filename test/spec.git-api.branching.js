const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../src/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

let testDir;
let gitConfig;

const req = request(app);

describe('git-api branching', function () {
  this.timeout(8000);

  before(() => {
    return common.initRepo(req)
      .then((res) => { testDir = res; })
      .then(() => common.get(req, '/gitconfig', { path: testDir }))
      .then((res) => { gitConfig = res; });
  });
  after(() => common.post(req, '/testing/cleanup'));

  const commitMessage = 'Commit 1';
  const testFile1 = "testfile1.txt";

  it('should be possible to commit to master', () => {
    return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) })
      .then(() => common.post(req, '/commit', { path: testDir, message: commitMessage, files: [{ name: testFile1 }] }))
  });

  it('listing branches should work', () => {
    return common.get(req, '/branches', { path: testDir }).then((res) => {
      expect(res.length).to.be(1);
      expect(res[0].name).to.be('master');
      expect(res[0].current).to.be(true);
    });
  });

  const testBranch = 'testBranch';

  it('creating a branch should work', () => {
    return common.post(req, '/branches', { path: testDir, name: testBranch, startPoint: 'master' });
  });

  it('listing branches should show the new branch', () => {
    return common.get(req, '/branches', { path: testDir }).then((res) => {
      expect(res.length).to.be(2);
      expect(res[0].name).to.be('master');
      expect(res[0].current).to.be(true);
      expect(res[1].name).to.be(testBranch);
      expect(res[1].current).to.be(undefined);
    });
  });

  it('should be possible to switch to a branch', () => {
    return common.post(req, '/checkout', { path: testDir, name: testBranch });
  });

  it('listing branches should show the new branch as current', () => {
    return common.get(req, '/branches', { path: testDir }).then(res => {
      expect(res.length).to.be(2);
      expect(res[0].name).to.be('master');
      expect(res[0].current).to.be(undefined);
      expect(res[1].name).to.be(testBranch);
      expect(res[1].current).to.be(true);
    });
  });

  it('get branch should show the new branch as current', () => {
    return common.get(req, '/checkout', { path: testDir })
      .then(res => expect(res).to.be(testBranch));
  });

  const commitMessage3 = 'Commit 3';
  const testFile2 = "testfile2.txt";

  it('should be possible to commit to the branch', () => {
    return common.post(req, '/testing/createfile', { file: path.join(testDir, testFile2) })
      .then(() => common.post(req, '/commit', { path: testDir, message: commitMessage3, files: [ {name: testFile2} ] }));
  });

  it('log should show both branches and all commits', () => {
    return common.get(req, '/log', { path: testDir }).then(res => {
      expect(res.skip).to.be(0);
      expect(res.limit).to.be(25);

      const nodes = res.nodes
      expect(nodes).to.be.a('array');
      expect(nodes.length).to.be(2);
      const objs = {};
      nodes.forEach((obj) => {
        obj.refs.sort();
        objs[obj.refs[0]] = obj;
      });
      const master = objs['refs/heads/master'];
      const HEAD = objs['HEAD'];
      expect(master.message.indexOf(commitMessage)).to.be(0);
      expect(master.authorDate).to.be.a('string');
      expect(master.authorName).to.be(gitConfig['user.name']);
      expect(master.authorEmail).to.be(gitConfig['user.email']);
      expect(master.commitDate).to.be.a('string');
      expect(master.committerName).to.be(gitConfig['user.name']);
      expect(master.committerEmail).to.be(gitConfig['user.email']);
      expect(master.refs).to.eql(['refs/heads/master']);
      expect(master.parents).to.eql([]);
      expect(master.sha1).to.be.ok();

      expect(HEAD.message.indexOf(commitMessage3)).to.be(0);
      expect(HEAD.authorDate).to.be.a('string');
      expect(HEAD.authorName).to.be(gitConfig['user.name']);
      expect(HEAD.authorEmail).to.be(gitConfig['user.email']);
      expect(HEAD.commitDate).to.be.a('string');
      expect(HEAD.committerName).to.be(gitConfig['user.name']);
      expect(HEAD.committerEmail).to.be(gitConfig['user.email']);
      expect(HEAD.refs).to.eql(['HEAD', `refs/heads/${testBranch}`]);
      expect(HEAD.parents).to.eql([master.sha1]);
      expect(HEAD.sha1).to.be.ok();
    });
  });

  it('should be possible to modify some local file', () => {
    return common.post(req, '/testing/changefile', { file: path.join(testDir, testFile1) });
  });

  it('should be possible to checkout another branch with local modifications', () => {
    return common.post(req, '/checkout', { path: testDir, name: 'master' });
  });

  it('status should list the changed file', () => {
    return common.get(req, '/status', { path: testDir }).then(res => {
      expect(Object.keys(res.files).length).to.be(1);
      expect(res.files[testFile1]).to.eql({
        displayName: testFile1,
        isNew: false,
        staged: false,
        removed: false,
        conflict: false,
        renamed: false,
        type: 'text',
        additions: '1',
        deletions: '1'
      });
    });
  });


  it('should be possible to create a tag', () => {
    return common.post(req, '/tags', { path: testDir, name: 'v1.0' });
  });

  it('should be possible to list tag', () => {
    return common.get(req, '/tags', { path: testDir })
      .then(res => expect(res.length).to.be(1));
  });

  it('should be possible to delete a tag', () => {
    return common.delete(req, '/tags', { path: testDir, name: 'v1.0' });
  });

  it('tag should be removed', () => {
    return common.get(req, '/tags', { path: testDir })
      .then(res => expect(res.length).to.be(0));
  });

  it('should be possible to delete a branch', () => {
    return common.delete(req, '/branches', { path: testDir, name: testBranch });
  });

  it('branch should be removed', () => {
    return common.get(req, '/branches', { path: testDir })
      .then(res => expect(res.length).to.be(1));
  });
});
