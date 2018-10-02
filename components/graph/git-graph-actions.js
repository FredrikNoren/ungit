
const ko = require('knockout');
const inherits = require('util').inherits;
const components = require('ungit-components');
const RefViewModel = require('./git-ref.js');
const HoverActions = require('./hover-actions');
const programEvents = require('ungit-program-events');
const RebaseViewModel = HoverActions.RebaseViewModel;
const MergeViewModel = HoverActions.MergeViewModel;
const ResetViewModel = HoverActions.ResetViewModel;
const PushViewModel = HoverActions.PushViewModel;
const SquashViewModel = HoverActions.SquashViewModel

class ActionBase {
  constructor(graph, text, style, icon) {
    this.graph = graph;
    this.server = graph.server;
    this.isRunning = ko.observable(false);
    this.isHighlighted = ko.computed(() => {
      return !graph.hoverGraphAction() || graph.hoverGraphAction() == this;
    });
    this.text = text;
    this.style = style;
    this.icon = icon;
    this.cssClasses = ko.computed(() => {
      if (!this.isHighlighted() || this.isRunning()) {
        return `${this.style} dimmed`
      } else {
        return this.style
      }
    });
  }
  doPerform() {
    if (this.isRunning()) return;
    this.graph.hoverGraphAction(null);
    this.isRunning(true);
    return this.perform()
      .catch((e) => this.server.unhandledRejection(e))
      .finally(() => { this.isRunning(false); });
  }
  dragEnter() {
    if (!this.visible()) return;
    this.graph.hoverGraphAction(this);
  }
  dragLeave() {
    if (!this.visible()) return;
    this.graph.hoverGraphAction(null);
  }
  mouseover() {
    this.graph.hoverGraphAction(this);
  }
  mouseout() {
    this.graph.hoverGraphAction(null);
  }
}

class Move extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Move', 'move', 'glyph_icon glyph_icon-move');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        this.graph.currentActionContext().node() != this.node;
    });
  }
  perform() {
    return this.graph.currentActionContext().moveTo(this.node.sha1);
  }
}

class Reset extends ActionBase {
  constructor (graph, node) {
    super(graph, 'Reset', 'reset', 'glyph_icon glyph_icon-trash');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      if (!(this.graph.currentActionContext() instanceof RefViewModel)) return false;
      const context = this.graph.currentActionContext();
      if (context.node() != this.node) return false;
      const remoteRef = context.getRemoteRef(this.graph.currentRemote());
      return remoteRef && remoteRef.node() &&
        context && context.node() &&
        remoteRef.node() != context.node() &&
        remoteRef.node().date < context.node().date;
    });
  }

  createHoverGraphic() {
    const context = this.graph.currentActionContext();
    if (!context) return null;
    const remoteRef = context.getRemoteRef(this.graph.currentRemote());
    const nodes = context.node().getPathToCommonAncestor(remoteRef.node()).slice(0, -1);
    return new ResetViewModel(nodes);
  }
  perform() {
    const context = this.graph.currentActionContext();
    const remoteRef = context.getRemoteRef(this.graph.currentRemote());
    return components.create('yesnodialog', { title: 'Are you sure?', details: 'Resetting to ref: ' + remoteRef.name + ' cannot be undone with ungit.'})
      .show()
      .closeThen((diag) => {
        if (!diag.result()) return;
        return this.server.postPromise('/reset', { path: this.graph.repoPath(), to: remoteRef.name, mode: 'hard' })
          .then(() => { context.node(remoteRef.node()); });
      }).closePromise;
  }
}

class Rebase extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Rebase', 'rebase', 'oct_icon oct_icon-repo-forked flip');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        (!ungit.config.showRebaseAndMergeOnlyOnRefs || this.node.refs().length > 0) &&
        this.graph.currentActionContext().current() &&
        this.graph.currentActionContext().node() != this.node;
    });
  }

  createHoverGraphic() {
    let onto = this.graph.currentActionContext();
    if (!onto) return;
    if (onto instanceof RefViewModel) onto = onto.node();
    const path = onto.getPathToCommonAncestor(this.node);
    return new RebaseViewModel(this.node, path);
  }
  perform() {
    return this.server.postPromise('/rebase', { path: this.graph.repoPath(), onto: this.node.sha1 })
      .catch((err) => { if (err.errorCode != 'merge-failed') this.server.unhandledRejection(err); })
  }
}


class Merge extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Merge', 'merge', 'oct_icon oct_icon-git-merge');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      if (!this.graph.checkedOutRef() || !this.graph.checkedOutRef().node()) return false;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        !this.graph.currentActionContext().current() &&
        this.graph.checkedOutRef().node() == this.node;
    });
  }
  createHoverGraphic() {
    let node = this.graph.currentActionContext();
    if (!node) return null;
    if (node instanceof RefViewModel) node = node.node();
    return new MergeViewModel(this.graph, this.node, node);
  }
  perform() {
    return this.server.postPromise('/merge', { path: this.graph.repoPath(), with: this.graph.currentActionContext().localRefName })
      .catch((err) => { if (err.errorCode != 'merge-failed') this.server.unhandledRejection(err); })
  }
}


class Push extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Push', 'push', 'oct_icon oct_icon-cloud-upload');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        this.graph.currentActionContext().node() == this.node &&
        this.graph.currentActionContext().canBePushed(this.graph.currentRemote());
    });
  }

  createHoverGraphic() {
    const context = this.graph.currentActionContext();
    if (!context) return null;
    const remoteRef = context.getRemoteRef(this.graph.currentRemote());
    if (!remoteRef) return null;
    return new PushViewModel(remoteRef.node(), context.node());
  }
  perform() {
    const ref = this.graph.currentActionContext();
    const remoteRef = ref.getRemoteRef(this.graph.currentRemote());

    if (remoteRef) {
      return remoteRef.moveTo(ref.node().sha1);
    } else {
      return ref.createRemoteRef().then(() => {
          if (this.graph.HEAD().name == ref.name) {
            this.grah.HEADref().node(ref.node());
          }
        }).finally(() => programEvents.dispatch({ event: 'request-fetch-tags' }));
    }
  }
}

class Checkout extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Checkout', 'checkout', 'oct_icon oct_icon-desktop-download');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      if (this.graph.currentActionContext() instanceof RefViewModel)
        return this.graph.currentActionContext().node() == this.node &&
          !this.graph.currentActionContext().current();
      return ungit.config.allowCheckoutNodes &&
        this.graph.currentActionContext() == this.node;
    });
  }
  perform() {
    return this.graph.currentActionContext().checkout();
  }
}

class Delete extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Delete', 'delete', 'glyph_icon glyph_icon-remove');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        this.graph.currentActionContext().node() == this.node &&
        !this.graph.currentActionContext().current();
    });
  }
  perform() {
    const context = this.graph.currentActionContext();
    let details = `"${context.refName}"`;
    if (context.isRemoteBranch) {
      details = `<code _style='font-size: 100%'>REMOTE</code> ${details}`;
    }
    details = `Deleting ${details} branch or tag cannot be undone with ungit.`;

    return components.create('yesnodialog', { title: 'Are you sure?', details: details })
      .show()
      .closeThen((diag) => {
        if (diag.result()) return context.remove();
      }).closePromise;
  }
}

class CherryPick extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Cherry pick', 'cherry-pick', 'oct_icon oct_icon-circuit-board');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      const context = this.graph.currentActionContext();
      return context === this.node && this.graph.HEAD() && context.sha1 !== this.graph.HEAD().sha1
    });
  }
  perform() {
    return this.server.postPromise('/cherrypick', { path: this.graph.repoPath(), name: this.node.sha1 })
      .catch((err) => { if (err.errorCode != 'merge-failed') this.server.unhandledRejection(err); })
  }
}

class Uncommit extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Uncommit', 'uncommit', 'oct_icon oct_icon-zap');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() == this.node &&
        this.graph.HEAD() == this.node;
    });
  }
  perform() {
    return this.server.postPromise('/reset', { path: this.graph.repoPath(), to: 'HEAD^', mode: 'mixed' })
      .then(() => {
        let targetNode = this.node.belowNode;
        while (targetNode && !targetNode.ancestorOfHEAD()) {
          targetNode = targetNode.belowNode;
        }
        this.graph.HEADref().node(targetNode ? targetNode : null);
        this.graph.checkedOutRef().node(targetNode ? targetNode : null);
      });
  }
}

class Revert extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Revert', 'revert', 'oct_icon oct_icon-history');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() == this.node;
    });
  }
  perform() {
    return this.server.postPromise('/revert', { path: this.graph.repoPath(), commit: this.node.sha1 });
  }
}

class Squash extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Squash', 'squash', 'oct_icon oct_icon-fold');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        this.graph.currentActionContext().current() &&
        this.graph.currentActionContext().node() != this.node;
    });
  }
  createHoverGraphic() {
    let onto = this.graph.currentActionContext();
    if (!onto) return;
    if (onto instanceof RefViewModel) onto = onto.node();

    return new SquashViewModel(this.node, onto);
  }
  perform() {
    let onto = this.graph.currentActionContext();
    if (!onto) return;
    if (onto instanceof RefViewModel) onto = onto.node();
    // remove last element as it would be a common ancestor.
    const path = this.node.getPathToCommonAncestor(onto).slice(0, -1);

    if (path.length > 0) {
      // squashing branched out lineage
      // c is checkout with squash target of e, results in staging changes
      // from d and e on top of c
      //
      // a - b - (c)        a - b - (c) - [de]
      //  \           ->     \
      //   d  - <e>           d - <e>
      return this.server.postPromise('/squash', { path: this.graph.repoPath(), target: this.node.sha1 });
    } else {
      // squashing backward from same lineage
      // c is checkout with squash target of a, results in current ref moved
      // to a and staging changes within b and c on top of a
      //
      // <a> - b - (c)       (a) - b - c
      //                ->     \
      //                        [bc]
      return this.graph.currentActionContext().moveTo(this.node.sha1, true)
        .then(() => this.server.postPromise('/squash', { path: this.graph.repoPath(), target: onto.sha1 }))
    }
  }
}

const GraphActions = {
  Move: Move,
  Rebase: Rebase,
  Merge: Merge,
  Push: Push,
  Reset: Reset,
  Checkout: Checkout,
  Delete: Delete,
  CherryPick: CherryPick,
  Uncommit: Uncommit,
  Revert: Revert,
  Squash: Squash,
};
module.exports = GraphActions;
