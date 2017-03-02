
var expect = require('expect.js');
var request = require('supertest');
var _ = require('lodash');
var express = require('express');
var fs = require('fs');
var path = require('path');
var restGit = require('../src/git-api');
var common = require('./common.js');
var Bluebird = require('bluebird');

var app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

var testDirLocal1, testDirLocal2, testDirRemote;

var req = request(app);

describe('git-api remote', function () {

  this.timeout(4000);

  it('creating test dirs should work', function(done) {
    Bluebird.all([common.post(req, '/testing/createtempdir', null),
      common.post(req, '/testing/createtempdir', null),
      common.post(req, '/testing/createtempdir', null)])
      .then(function(res) {
        expect(res[0].body.path).to.be.ok();
        expect(res[1].body.path).to.be.ok();
        expect(res[2].body.path).to.be.ok();
        testDirLocal1 = res[0].body.path;
        testDirLocal2 = res[1].body.path;
        testDirRemote = res[2].body.path;
      }).then(function() { done(); }).catch(done);
  });

  it('init a bare "remote" test dir should work', function(done) {
    common.post(req, '/init', { path: testDirRemote, bare: true })
      .then(function() { done(); }).catch(done);
  });

  it('remotes in no-remotes-repo should be zero', function(done) {
    common.get(req, '/remotes', { path: testDirRemote }).then(function(res) {
      expect(res.body.length).to.be(0);
    }).then(function() { done(); }).catch(done);
  });

  it('cloning "remote" to "local1" should work', function(done) {
    common.post(req, '/clone', { path: testDirLocal1, url: testDirRemote, destinationDir: '.' })
      .then(function() { done(); }).catch(done);
  });

  it('remotes in cloned-repo should be one', function(done) {
    common.get(req, '/remotes', { path: testDirLocal1 }).then(function(res) {
      expect(res.body.length).to.be(1);
      expect(res.body[0]).to.be('origin');
    }).then(function() { done(); }).catch(done);
  });

  it('remote/origin in cloned-repo should work', function(done) {
    common.get(req, '/remotes/origin', { path: testDirLocal1 }).then(function(res) {
      expect(res.body.address).to.be(testDirRemote);
    }).then(function() { done(); }).catch(done);
  });

  it('creating a commit in "local1" repo should work', function(done) {
    var testFile = path.join(testDirLocal1, "testfile1.txt");
    common.post(req, '/testing/createfile', { file: testFile })
      .then(function() { return common.post(req, '/commit', { path: testDirLocal1, message: "Init", files: [{ name: testFile }] }); })
      .then(function() { done(); }).catch(done);
  });

  it('log in "local1" should show the init commit', function(done) {
    common.get(req, '/log', { path: testDirLocal1 }).then(function(res) {
      expect(res.body.nodes).to.be.a('array');
      expect(res.body.nodes.length).to.be(1);
      var init = res.body.nodes[0];
      expect(init.message.indexOf('Init')).to.be(0);
      expect(init.refs).to.contain('HEAD');
      expect(init.refs).to.contain('refs/heads/master');
    }).then(function() { done(); }).catch(done);
  });

  it('pushing form "local1" to "remote" should work', function(done) {
    common.post(req, '/push', { path: testDirLocal1, remote: 'origin' })
      .then(function() { done(); }).catch(done);
  });

  it('cloning "remote" to "local2" should work', function(done) {
    common.post(req, '/clone', { path: testDirLocal2, url: testDirRemote, destinationDir: '.' })
      .then(function() { done(); }).catch(done);
  });

  it('log in "local2" should show the init commit', function(done) {
    common.get(req, '/log', { path: testDirLocal2 }).then(function(res) {
      expect(res.body.nodes).to.be.a('array');
      expect(res.body.nodes.length).to.be(1);
      var init = res.body.nodes[0];
      expect(init.message.indexOf('Init')).to.be(0);
      expect(init.refs).to.contain('HEAD');
      expect(init.refs).to.contain('refs/heads/master');
      expect(init.refs).to.contain('refs/remotes/origin/master');
      expect(init.refs).to.contain('refs/remotes/origin/HEAD');
    }).then(function() { done(); }).catch(done);
  });

  it('creating and pushing a commit in "local1" repo should work', function(done) {
    var testFile = path.join(testDirLocal1, "testfile2.txt");
    common.post(req, '/testing/createfile', { file: testFile })
      .then(function() { return common.post(req, '/commit', { path: testDirLocal1, message: "Commit2", files: [{ name: testFile }] }); })
      .then(function() { return common.post(req, '/push', { path: testDirLocal1, remote: 'origin' }); })
      .then(function() { done(); }).catch(done);
  });

  it('fetching in "local2" should work', function(done) {
    common.post(req, '/fetch', { path: testDirLocal2, remote: 'origin' })
      .then(function() { done(); }).catch(done);
  });

  it('log in "local2" should show the branch as one behind', function(done) {
    common.get(req, '/log', { path: testDirLocal2 }).then(function(res) {
      expect(res.body.nodes).to.be.a('array');
      expect(res.body.nodes.length).to.be(2);
      var init = _.find(res.body.nodes, function(node) { return node.message.indexOf('Init') == 0; });
      var commit2 = _.find(res.body.nodes, function(node) { return node.message.indexOf('Commit2') == 0; });
      expect(init).to.be.ok();
      expect(commit2).to.be.ok();
      expect(init.refs).to.contain('HEAD');
      expect(init.refs).to.contain('refs/heads/master');
      expect(commit2.refs).to.contain('refs/remotes/origin/master');
      expect(commit2.refs).to.contain('refs/remotes/origin/HEAD');
    }).then(function() { done(); }).catch(done);
  });

  it('rebasing local master onto remote master should work in "local2"', function(done) {
    common.post(req, '/rebase', { path: testDirLocal2, onto: 'origin/master' })
      .then(function() { done(); }).catch(done);
  });

  it('log in "local2" should show the branch as in sync', function(done) {
    common.get(req, '/log', { path: testDirLocal2 }).then(function(res) {
      expect(res.body.nodes).to.be.a('array');
      expect(res.body.nodes.length).to.be(2);
      var init = _.find(res.body.nodes, function(node) { return node.message.indexOf('Init') == 0; });
      var commit2 = _.find(res.body.nodes, function(node) { return node.message.indexOf('Commit2') == 0; });
      expect(init).to.be.ok();
      expect(commit2).to.be.ok();
      expect(init.refs).to.eql([]);
      expect(commit2.refs).to.contain('HEAD');
      expect(commit2.refs).to.contain('refs/heads/master');
      expect(commit2.refs).to.contain('refs/remotes/origin/master');
      expect(commit2.refs).to.contain('refs/remotes/origin/HEAD');
    }).then(function() { done(); }).catch(done);
  });

  it('creating a commit in "local2" repo should work', function(done) {
    var testFile = path.join(testDirLocal2, "testfile3.txt");
    common.post(req, '/testing/createfile', { file: testFile })
      .then(function() { return common.post(req, '/commit', { path: testDirLocal2, message: "Commit3", files: [{ name: testFile }] }); })
      .then(function() { done(); }).catch(done);
  });

  it('resetting local master to remote master should work in "local2"', function(done) {
    common.post(req, '/reset', { path: testDirLocal2, to: 'origin/master', mode: 'hard' })
      .then(function() { done(); }).catch(done);
  });

  it('log in "local2" should show the branch as in sync', function(done) {
    common.get(req, '/log', { path: testDirLocal2 }).then(function(res) {
      expect(res.body.nodes.length).to.be(2);
      var init = _.find(res.body.nodes, function(node) { return node.message.indexOf('Init') == 0; });
      var commit2 = _.find(res.body.nodes, function(node) { return node.message.indexOf('Commit2') == 0; });
      expect(init.refs).to.eql([]);
      expect(commit2.refs).to.contain('HEAD');
      expect(commit2.refs).to.contain('refs/heads/master');
      expect(commit2.refs).to.contain('refs/remotes/origin/master');
      expect(commit2.refs).to.contain('refs/remotes/origin/HEAD');
    }).then(function() { done(); }).catch(done);
  });

  it('status should show nothing', function(done) {
    common.get(req, '/status', { path: testDirLocal2 }).then(function(res) {
      expect(Object.keys(res.body.files).length).to.be(0);
    }).then(function() { done(); }).catch(done);
  });

  it('should be possible to create a tag in "local2"', function(done) {
    common.post(req, '/tags', { path: testDirLocal2, name: 'v1.0' })
      .then(function() { done(); }).catch(done);
  });

  it('should be possible to push a tag from "local2"', function(done) {
    common.post(req, '/push', { path: testDirLocal2, remote: 'origin', refSpec: 'v1.0', remoteBranch: 'v1.0' })
      .then(function() { done(); }).catch(done);
  });

  it('log in "local2" should show the local tag', function(done) {
    common.get(req, '/log', { path: testDirLocal2 }).then(function(res) {
      var commit2 = _.find(res.body.nodes, function(node) { return node.message.indexOf('Commit2') == 0; });
      expect(commit2.refs).to.contain('tag: refs/tags/v1.0');
    }).then(function() { done(); }).catch(done);
  });

  it('remote tags in "local2" should show the remote tag', function(done) {
    common.get(req, '/remote/tags', { path: testDirLocal2, remote: 'origin' }).then(function(res) {
      expect(res.body.map(function(tag) { return tag.name; })).to.contain('refs/tags/v1.0^{}');
    }).then(function() { done(); }).catch(done);
  });

  after(function(done) {
    common.post(req, '/testing/cleanup', undefined)
      .then(function() { done(); }).catch(done);
  });

});
