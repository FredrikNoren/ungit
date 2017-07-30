var ko = require('knockout');
var md5 = require('blueimp-md5');
var Selectable = require('./selectable');
var programEvents = require('ungit-program-events');
var components = require('ungit-components');
var Promise = require('bluebird');

var RefViewModel = function(fullRefName, graph) {
  var self = this;
  Selectable.call(this, graph);
  this.graph = graph;
  this.name = fullRefName;
  this.node = ko.observable();
  this.localRefName = this.name; // origin/master or master
  this.refName = this.name; // master
  this.isRemoteTag = this.name.indexOf('remote-tag: ') == 0;
  this.isLocalTag = this.name.indexOf('tag: ') == 0;
  this.isTag = this.isLocalTag || this.isRemoteTag;
  var isRemoteBranchOrHEAD = this.name.indexOf('refs/remotes/') == 0;
  this.isLocalHEAD = this.name == 'HEAD';
  this.isRemoteHEAD = this.name.indexOf('/HEAD') != -1;
  this.isLocalBranch = this.name.indexOf('refs/heads/') == 0;
  this.isRemoteBranch = isRemoteBranchOrHEAD && !this.isRemoteHEAD;
  this.isStash = this.name.indexOf('refs/stash') == 0;
  this.isHEAD = this.isLocalHEAD || this.isRemoteHEAD;
  this.isBranch = this.isLocalBranch || this.isRemoteBranch;
  this.isRemote = isRemoteBranchOrHEAD || this.isRemoteTag;
  this.isLocal = this.isLocalBranch || this.isLocalTag;
  if (this.isLocalBranch) {
    this.localRefName = this.name.slice('refs/heads/'.length);
    this.refName = this.localRefName;
  }
  if (this.isRemoteBranch) {
    this.localRefName = this.name.slice('refs/remotes/'.length);
  }
  if (this.isLocalTag) {
    this.localRefName = this.name.slice('tag: refs/tags/'.length);
    this.refName = this.localRefName;
  }
  if (this.isRemoteTag) {
    this.localRefName = this.name.slice('remote-tag: '.length);
  }
  if (this.isRemote) {
    // get rid of the origin/ part of origin/branchname
    var s = this.localRefName.split('/');
    this.remote = s[0];
    this.refName = s.slice(1).join('/');
  }
  this.show = true;
  this.server = this.graph.server;
  this.isDragging = ko.observable(false);
  this.current = ko.computed(function() {
    return self.isLocalBranch && self.graph.checkedOutBranch() == self.refName;
  });
  this.color = this._colorFromHashOfString(this.name);

  this.node.subscribe(function(oldNode) {
    if (oldNode) oldNode.removeRef(self);
  }, null, "beforeChange");
  this.node.subscribe(function(newNode) {
    if (newNode) newNode.pushRef(self);
  });
};
module.exports = RefViewModel;

RefViewModel.prototype._colorFromHashOfString = function(string) {
  return '#' + md5(string).toString().slice(0, 6);
}
RefViewModel.prototype.dragStart = function() {
  this.graph.currentActionContext(this);
  this.isDragging(true);
  if (document.activeElement) document.activeElement.blur();
}
RefViewModel.prototype.dragEnd = function() {
  this.graph.currentActionContext(null);
  this.isDragging(false);
}
RefViewModel.prototype.moveTo = function(target) {
  var self = this;
  var promise;
  if (this.isLocal) {
    var toNode = this.graph.nodesById[target];
    var args = { path: self.graph.repoPath(), name: self.refName, sha1: target, force: true, to: target, mode: 'hard' };
    var operation;
    if (this.current()) {
      operation = '/reset';
    } else if (this.isTag) {
      operation = '/tags';
    } else {
      operation = '/branches';
    }

    if (this.node().date > toNode.date) {
      promise = components.create('yesnodialog', { title: 'Are you sure?', details: 'This operation potentially going back in history.'})
        .show()
        .closeThen(function(diag) {
          if (diag.result()) {
            return self.server.postPromise(operation, args);
          }
        }).closePromise;
    } else {
      promise = self.server.postPromise(operation, args);
    }
  } else {
    var pushReq = { path: this.graph.repoPath(), remote: this.remote, refSpec: target, remoteBranch: this.refName };
    promise = this.server.postPromise('/push', pushReq)
      .catch(function(err) {
        if (err.errorCode == 'non-fast-forward') {
          return components.create('yesnodialog', { title: 'Force push?', details: 'The remote branch can\'t be fast-forwarded.' })
            .show()
            .closeThen(function(diag) {
              if (!diag.result()) return false;
              pushReq.force = true;
              return self.server.postPromise('/push', pushReq);
            }).closePromise;
        }
      });
  }

  return promise
    .then(function(res) {
      if (!res) return;
      var targetNode = self.graph.getNode(target);
      if (self.graph.checkedOutBranch() == self.refName) {
        self.graph.HEADref().node(targetNode);
      }
      self.node(targetNode);
    });
}

RefViewModel.prototype.remove = function() {
  var self = this;
  var url = this.isTag ? '/tags' : '/branches';
  if (this.isRemote) url = '/remote' + url;

  return this.server.delPromise(url, { path: this.graph.repoPath(), remote: this.isRemote ? this.remote : null, name: this.refName })
    .then(function() {
      self.node().removeRef(self);
      self.graph.refsByRefName[self.name] = undefined;
    }).finally(function() {
      if (url == '/remote/tags') {
        programEvents.dispatch({ event: 'request-fetch-tags' });
      } else {
        programEvents.dispatch({ event: 'branch-updated' });
      }
      return self.graph.loadNodesFromApi();
    });
}

RefViewModel.prototype.getLocalRef = function() {
  return this.graph.getRef(this.getLocalRefFullName(), false);
}
RefViewModel.prototype.getLocalRefFullName = function() {
  if (this.isRemoteBranch) return 'refs/heads/' + this.refName;
  if (this.isRemoteTag) return 'tag: ' + this.refName;
  return null;
}

RefViewModel.prototype.getRemoteRef = function(remote) {
  return this.graph.getRef(this.getRemoteRefFullName(remote), false);
}

RefViewModel.prototype.getRemoteRefFullName = function(remote) {
  if (this.isLocalBranch) return 'refs/remotes/' + remote + '/' + this.refName;
  if (this.isLocalTag) return 'remote-tag: ' + remote + '/' + this.refName;
  return null;
}

RefViewModel.prototype.canBePushed = function(remote) {
  if (!this.isLocal) return false;
  var remoteRef = this.getRemoteRef(remote);
  if (!remoteRef) return true;
  return this.node() != remoteRef.node();
}

RefViewModel.prototype.createRemoteRef = function() {
  var self = this;
  return this.server.postPromise('/push', { path: this.graph.repoPath(), remote: this.graph.currentRemote(),
    refSpec: this.refName, remoteBranch: this.refName }).then(function() {
      var newRef = self.graph.getRef("refs/remotes/" + self.graph.currentRemote() + "/" + self.refName);
      newRef.node(self.node());
    });
}
