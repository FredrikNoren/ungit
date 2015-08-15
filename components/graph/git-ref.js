var ko = require('knockout');
var md5 = require('blueimp-md5').md5;

var RefViewModel = function(fullRefName, graph) {
  var self = this;
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
  this.localRef = ko.observable();
  this.isDragging = ko.observable(false);
  this.current = ko.computed(function() {
    return self.isLocalBranch && self.graph.checkedOutBranch() == self.refName;
  });
  this.color = this._colorFromHashOfString(this.name);
  
};
module.exports = RefViewModel;

RefViewModel.prototype._colorFromHashOfString = function(string) {
  return '#' + md5(string).toString().slice(0, 6);
}
