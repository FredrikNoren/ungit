
var ko = require('knockout');
var md5 = require('blueimp-md5').md5;
var moment = require('moment');
var inherits = require('util').inherits;
var Selectable = require('./git-selectable').Selectable;
var GraphActions = require('./git-graph-actions');
var NodeViewModel = require('./graph-graphics/node').NodeViewModel;
var components = require('ungit-components');
var Vector2 = require('ungit-vector2');

var GitNodeViewModel = function(graph, sha1) {
  NodeViewModel.call(this);
  Selectable.call(this, graph);
  var self = this;

  this.graph = graph;
  this.server = graph.server;
  this.sha1 = sha1;

  this.isInited = false;

  this.logBoxElement = ko.observable();
  this.boxDisplayX = ko.computed(function() {
    return self.x();
  });
  this.boxDisplayY = ko.computed(function() {
    return self.y();
  });
  this.logBoxX = ko.computed(function() {
    return -self.radius();
  })
  this.refsX = ko.computed(function() {
    return self.radius();
  });
  this.nodeX = ko.computed(function() {
    return -self.radius();
  });
  this.nodeY = ko.computed(function() {
    return -self.radius();
  });
  this.nodeWidth = ko.computed(function() {
    return self.radius()*2;
  });
  this.nodeHeight = ko.computed(function() {
    return self.radius()*2;
  });
  this.aboveNode = null; // The node directly above this, graphically

  this.commitTime = ko.observable();
  this.authorTime = ko.observable();
  this.parents = ko.observable([]);
  this.message = ko.observable();
  this.title = ko.observable();
  this.body = ko.observable();
  this.authorDate = ko.observable(0);
  this.authorDateFromNow = ko.observable();
  this.authorName = ko.observable();
  this.authorEmail = ko.observable();
  this.fileLineDiffs = ko.observable();
  this.numberOfAddedLines = ko.observable();
  this.numberOfRemovedLines = ko.observable();
  this.authorGravatar = ko.computed(function() { return md5(self.authorEmail()); });

  this.index = ko.observable();
  this.ideologicalBranch = ko.observable();
  self.ideologicalBranch.subscribe(function(value) {
    self.color(value ? value.color : '#666');
  });
  this.ancestorOfHEAD = ko.observable(false);
  this.nodeIsMousehover = ko.observable(false);
  this.logBoxVisible = ko.computed(function() {
    return (self.ancestorOfHEAD() && self.isAtFinalXPosition()) || self.nodeIsMousehover() || self.selected();
  });
  this.highlighted = ko.computed(function() {
    return self.nodeIsMousehover() || self.selected();
  });
  this.commitDiff = ko.computed(function() {
    if ((self.selected() || self.highlighted()) && self.fileLineDiffs()) return components.create('commitDiff', {
      fileLineDiffs: self.fileLineDiffs().slice(), sha1: self.sha1, repoPath: self.graph.repoPath, server: self.server });
    else return null;
  });
  this.showCommitDiff = ko.computed(function() {
    return self.fileLineDiffs() && self.fileLineDiffs().length > 0;
  });
  this.screenWidth = ko.observable();
  this.diffStyle = ko.computed(function() {
    if (self.selected()) return { left: -self.boxDisplayX() + 'px', width: (self.screenWidth() - 120) + 'px' };
    else return { left: '0px', width: self.logBoxElement() ? ((self.logBoxElement().clientWidth - 20) + 'px') : 'inherit' };
  });
  // These are split up like this because branches and local tags can be found in the git log,
  // whereas remote tags needs to be fetched with another command (which is much slower)
  this.branchesAndLocalTags = ko.observable([]);
  this.remoteTags = ko.observable([]);
  this.refs = ko.computed(function() {
    var rs = self.branchesAndLocalTags().concat(self.remoteTags());
    rs.sort(function(a, b) {
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return a.refName < b.refName ? -1 : 1;
    });
    return rs;
  });
  this.branches = ko.computed(function() {
    return self.refs().filter(function(r) { return r.isBranch; });
  });
  this.tags = ko.computed(function() {
    return self.refs().filter(function(r) { return r.isTag; });
  });
  this.showNewRefAction = ko.computed(function() {
    return !graph.currentActionContext();
  })
  this.newBranchName = ko.observable();
  this.newBranchNameHasFocus = ko.observable(true);
  this.newBranchNameHasFocus.subscribe(function(newValue) {
    if (!newValue) {
      // Small timeout because in ff the form is hidden before the submit click event is registered otherwise
      setTimeout(function() {
        self.branchingFormVisible(false);
      }, 200);
    }
  })
  this.branchingFormVisible = ko.observable(false);
  this.canCreateRef = ko.computed(function() {
    return self.newBranchName() && self.newBranchName().trim() && self.newBranchName().indexOf(' ') == -1;
  });

  this.dropareaGraphActions = [
    new GraphActions.Move(this.graph, this),
    new GraphActions.Rebase(this.graph, this),
    new GraphActions.Merge(this.graph, this),
    new GraphActions.Push(this.graph, this),
    new GraphActions.Reset(this.graph, this),
    new GraphActions.Checkout(this.graph, this),
    new GraphActions.Delete(this.graph, this),
    new GraphActions.CherryPick(this.graph, this),
    new GraphActions.Uncommit(this.graph, this),
    new GraphActions.Revert(this.graph, this)
  ];
}
inherits(GitNodeViewModel, NodeViewModel);
exports.GitNodeViewModel = GitNodeViewModel;
GitNodeViewModel.prototype.setData = function(args) {
  this.commitTime(moment(new Date(args.commitDate)));
  this.authorTime(moment(new Date(args.authorDate)));
  this.parents(args.parents || []);
  var message = args.message.split('\n');
  this.message(args.message);
  this.title(message[0]);
  this.body(message.slice(2).join('\n'));
  this.authorDate(moment(new Date(args.authorDate)));
  this.authorDateFromNow(this.authorDate().fromNow());
  this.authorName(args.authorName);
  this.authorEmail(args.authorEmail);
  this.numberOfAddedLines(args.fileLineDiffs.length > 0 ? args.fileLineDiffs[0][0] : 0);
  this.numberOfRemovedLines(args.fileLineDiffs.length > 0 ? args.fileLineDiffs[0][1] : 0);
  this.fileLineDiffs(args.fileLineDiffs);
  this.isInited = true;
}
GitNodeViewModel.prototype.updateLastAuthorDateFromNow = function(deltaT) {
  this.lastUpdatedAuthorDateFromNow = this.lastUpdatedAuthorDateFromNow || 0;
  this.lastUpdatedAuthorDateFromNow += deltaT;
  if(this.lastUpdatedAuthorDateFromNow > 60 * 1000) {
    this.lastUpdatedAuthorDateFromNow = 0;
    this.authorDateFromNow(this.authorDate().fromNow());
  }
}
GitNodeViewModel.prototype.updateAnimationFrame = function(deltaT) {
  this.updateLastAuthorDateFromNow(deltaT);
  GitNodeViewModel.super_.prototype.updateAnimationFrame.call(this, deltaT);

  this.updateGoalPosition();
}
GitNodeViewModel.prototype.updateGoalPosition = function() {
  var goalPosition = new Vector2();
  if (this.ancestorOfHEAD()) {
    if (!this.aboveNode)
      goalPosition.y = 120;
    else if (this.aboveNode.ancestorOfHEAD())
      goalPosition.y = this.aboveNode.goalPosition().y + 120;
    else
      goalPosition.y = this.aboveNode.goalPosition().y + 60;
    goalPosition.x = 30;
    this.setRadius(30);
  } else {
    if (this.aboveNode) {
      goalPosition.y = this.aboveNode.goalPosition().y + 60;
    } else {
      goalPosition.y = 120;
    }
    
    goalPosition.x = 30 + 90 * this.branchOrder;
    this.setRadius(15);
  }
  if (this.aboveNode && this.aboveNode.selected()) {
    goalPosition.y = this.aboveNode.goalPosition().y + this.aboveNode.logBoxElement().offsetHeight + 30;
  }
  var dw = window.innerWidth;
  if (this.screenWidth() != dw) this.screenWidth(dw);
  this.setPosition(goalPosition);
}
GitNodeViewModel.prototype.showBranchingForm = function() {
  this.branchingFormVisible(true);
  this.newBranchNameHasFocus(true);
}
GitNodeViewModel.prototype.createBranch = function() {
  if (!this.canCreateRef()) return;
  this.server.post('/branches', { path: this.graph.repoPath, name: this.newBranchName(), startPoint: this.sha1 });
  this.branchingFormVisible(false);
  this.newBranchName('');
}
GitNodeViewModel.prototype.createTag = function() {
  if (!this.canCreateRef()) return;
  this.server.post('/tags', { path: this.graph.repoPath, name: this.newBranchName(), startPoint: this.sha1 });
  this.branchingFormVisible(false);
  this.newBranchName('');
}
GitNodeViewModel.prototype.isAncestor = function(node) {
  if (this.index() >= this.graph.maxNNodes) return false;
  if (node == this) return true;
  for (var v in this.parents()) {
    var n = this.graph.nodesById[this.parents()[v]];
    if (n && n.isAncestor(node)) return true;
  }
  return false;
}
GitNodeViewModel.prototype.getPathToCommonAncestor = function(node) {
  var path = [];
  var thisNode = this;
  while (thisNode && !node.isAncestor(thisNode)) {
    path.push(thisNode);
    thisNode = this.graph.nodesById[thisNode.parents()[0]];
  }
  if (thisNode)
    path.push(thisNode);
  return path;
}
GitNodeViewModel.prototype.toggleSelected = function() {
  var self = this;
  var beforeThisCR = this.logBoxElement().getBoundingClientRect();
  var beforeBelowCR = null;
  if (this.belowNode)
    beforeBelowCR = this.belowNode.logBoxElement().getBoundingClientRect();
  
  var prevSelected  = this.graph.currentActionContext();
  if (!(prevSelected instanceof GitNodeViewModel)) prevSelected = null;
  var prevSelectedCR = null;
  if (prevSelected) prevSelectedCR = prevSelected.logBoxElement().getBoundingClientRect();
  this.selected(!this.selected());

  setTimeout(function(){
    self.graph.instantUpdatePositions();
    // If we are deselecting
    if (!self.selected()) {
      if (beforeThisCR.top < 0 && beforeBelowCR) {
        var afterBelowCR = self.belowNode.logBoxElement().getBoundingClientRect();
        // If the next node is showing, try to keep it in the screen (no jumping)
        if (beforeBelowCR.top < window.innerHeight) {
          window.scrollBy(0, afterBelowCR.top - beforeBelowCR.top);
        // Otherwise just try to bring them to the middle of the screen
        } else {
          window.scrollBy(0, afterBelowCR.top - window.innerHeight / 2);
        }
      }
    // If we are selecting
    } else {
      var afterThisCR = self.logBoxElement().getBoundingClientRect();
      if ((prevSelectedCR && (prevSelectedCR.top < 0 || prevSelectedCR.top > window.innerHeight)) &&
        afterThisCR.top != beforeThisCR.top) {
        window.scrollBy(0, -(beforeThisCR.top - afterThisCR.top));
        console.log('Fix')
      }
    }
  }, 0);
}
GitNodeViewModel.prototype.nodeMouseover = function() {
  this.nodeIsMousehover(true);
}
GitNodeViewModel.prototype.nodeMouseout = function() {
  this.nodeIsMousehover(false);
}
