import * as ko from 'knockout';
import { AbstractNode } from './abstract-node';
import {
  RebaseViewModel,
  MergeViewModel,
  ResetViewModel,
  PushViewModel,
  SquashViewModel
} from './hover-actions';

const octicons = require('octicons');
declare var ungit: any;
const components = ungit.components;
const programEvents = ungit.programEvents;

export class ActionBase {
  graph: any
  server: any
  text: string
  style: string
  icon: string
  cssClasses: ko.Computed<string>
  visible: ko.Computed<boolean>
  node: AbstractNode // git-node

  constructor(graph: any, text: string, style: string, icon: string) {
    this.graph = graph;
    this.server = graph.server;
    this.text = text;
    this.style = style;
    this.icon = icon;
    this.cssClasses = ko.computed(() => {
      const isHighlighted = !this.graph.hoverGraphAction() || this.graph.hoverGraphAction() == this;
      if (!isHighlighted || this.graph.isActionRunning()) {
        return `${this.style} dimmed`;
      } else {
        return this.style;
      }
    });
  }

  doPerform() {
    if (this.graph.isActionRunning()) return;
    this.graph.hoverGraphAction(null);
    this.graph.isActionRunning(true);
    return this.perform()
      .catch((e) => this.server.unhandledRejection(e))
      .finally(() => {
        this.graph.isActionRunning(false);
      });
  }

  dragEnter() {
    if (!this.visible()) return;
    if (this.graph.hoverGraphAction() !== this) {
      this.graph.hoverGraphAction(this);
    }
  }

  dragLeave() {
    if (!this.visible()) return;
    if (this.graph.hoverGraphAction() !== null) {
      this.graph.hoverGraphAction(null);
    }
  }

  mouseover() {
    if (!this.visible()) return;
    if (this.graph.hoverGraphAction() !== this) {
      this.graph.hoverGraphAction(this);
    }
  }

  mouseout() {
    if (!this.visible()) return;
    if (this.graph.hoverGraphAction() !== null) {
      this.graph.hoverGraphAction(null);
    }
  }

  perform(): Promise<unknown> {
    return Promise.reject()
  }
}

export class Move extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Move', 'move', octicons['arrow-left'].toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      return (
        this.graph.isCurrentActionContextRef() &&
        this.graph.getCurrentActionContextNode() != this.node
      );
    });
  }

  perform() {
    return this.graph.currentActionContext().moveTo(this.node.sha1);
  }
}

export class Reset extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Reset', 'reset', octicons.trash.toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      if (!this.graph.isCurrentActionContextRef()) return false;
      const context = this.graph.currentActionContext();
      if (context.node() != this.node) return false;
      const remoteRef = context.getRemoteRef(this.graph.currentRemote());
      return (
        remoteRef &&
        remoteRef.node() &&
        context &&
        context.node() &&
        remoteRef.node() != context.node() &&
        remoteRef.node().date < context.node().date
      );
    });
  }

  createHoverGraphic() {
    const context = this.graph.currentActionContext();
    if (!context) return null;
    const remoteRef = context.getRemoteRef(this.graph.currentRemote());
    const nodes = this.graph.nodesEdges.getPathToCommonAncestor(context.node(), remoteRef.node()).slice(0, -1);
    return new ResetViewModel(nodes);
  }

  perform() {
    const context = this.graph.currentActionContext();
    const remoteRef = context.getRemoteRef(this.graph.currentRemote());
    return new Promise((resolve, reject) => {
      components.showModal('yesnomodal', {
        title: 'Are you sure?',
        details: 'Resetting to ref: ' + remoteRef.name + ' cannot be undone with ungit.',
        closeFunc: async (isYes) => {
          if (isYes) {
            await this.server
              .postPromise('/reset', {
                path: this.graph.repoPath(),
                to: remoteRef.name,
                mode: 'hard',
              })
              .then(resolve)
              .catch(reject);
            context.node(remoteRef.node());
          }
          this.graph.isActionRunning(false);
        },
      });
    });
  }
}

export class Rebase extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Rebase', 'rebase', octicons['repo-forked'].toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      return (
        this.graph.isCurrentActionContextRef() &&
        (!ungit.config.showRebaseAndMergeOnlyOnRefs || this.node.refs().length > 0) &&
        this.graph.currentActionContext().current() &&
        this.graph.currentActionContext().node() != this.node
      );
    });
  }

  createHoverGraphic() {
    const onto = this.graph.getCurrentActionContextNode();
    if (!onto) return;
    const path = this.graph.nodesEdges.getPathToCommonAncestor(onto, this.node);
    return new RebaseViewModel(this.node, path);
  }

  perform() {
    return this.server
      .postPromise('/rebase', { path: this.graph.repoPath(), onto: this.node.sha1 })
      .catch((err) => {
        if (err.errorCode != 'merge-failed') {
          this.server.unhandledRejection(err);
        } else {
          ungit.logger.warn('rebase failed', err);
        }
      });
  }
}

export class Merge extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Merge', 'merge', octicons['git-merge'].toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      if (!this.graph.checkedOutRef() || !this.graph.checkedOutRef().node()) return false;
      return (
        this.graph.isCurrentActionContextRef() &&
        !this.graph.currentActionContext().current() &&
        this.graph.checkedOutRef().node() == this.node
      );
    });
  }

  createHoverGraphic() {
    const node = this.graph.getCurrentActionContextNode();
    if (!node) return null;
    return new MergeViewModel(this.graph, this.node, node);
  }

  perform() {
    return this.server
      .postPromise('/merge', {
        path: this.graph.repoPath(),
        with: this.graph.currentActionContext().localRefName,
      })
      .catch((err) => {
        if (err.errorCode != 'merge-failed') {
          this.server.unhandledRejection(err);
        } else {
          ungit.logger.warn('merge failed', err);
        }
      });
  }
}

export class Push extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Push', 'push', octicons['repo-push'].toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      return (
        this.graph.isCurrentActionContextRef() &&
        this.graph.currentActionContext().node() == this.node &&
        this.graph.currentActionContext().canBePushed(this.graph.currentRemote())
      );
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
      return ref
        .createRemoteRef()
        .then(() => {
          if (this.graph.HEAD().name == ref.name) {
            this.graph.HEADref().node(ref.node());
          }
        })
        .finally(() => programEvents.dispatch({ event: 'request-fetch-tags' }));
    }
  }
}

export class Checkout extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Checkout', 'checkout', octicons['desktop-download'].toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.graph.isCurrentActionContextRef())
        return (
          this.graph.currentActionContext().node() == this.node &&
          !this.graph.currentActionContext().current()
        );
      return ungit.config.allowCheckoutNodes && this.graph.currentActionContext() == this.node;
    });
  }

  perform() {
    return this.graph.currentActionContext().checkout();
  }
}

export class Delete extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Delete', 'delete', octicons.x.toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      return (
        this.graph.isCurrentActionContextRef() &&
        this.graph.currentActionContext().node() == this.node &&
        !this.graph.currentActionContext().current()
      );
    });
  }

  perform() {
    const context = this.graph.currentActionContext();
    let details = `"${context.refName}"`;
    if (context.isRemoteBranch) {
      details = `<code _style="font-size: 100%">REMOTE</code> ${details}`;
    }
    details = `Deleting ${details} branch or tag cannot be undone with ungit.`;

    return new Promise((resolve, reject) => {
      components.showModal('yesnomodal', {
        title: 'Are you sure?',
        details: details,
        closeFunc: async (isYes) => {
          if (isYes) {
            await context.remove().then(resolve).catch(reject);
          }
          this.graph.isActionRunning(false);
        },
      });
    });
  }
}

export class CherryPick extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Cherry pick', 'cherry-pick', octicons.cpu.toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      const context = this.graph.currentActionContext();
      return context === this.node && this.graph.HEAD() && context.sha1 !== this.graph.HEAD().sha1;
    });
  }

  perform() {
    return this.server
      .postPromise('/cherrypick', { path: this.graph.repoPath(), name: this.node.sha1 })
      .catch((err) => {
        if (err.errorCode != 'merge-failed') {
          this.server.unhandledRejection(err);
        } else {
          ungit.logger.warn('cherrypick failed', err);
        }
      });
  }
}

export class Uncommit extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Uncommit', 'uncommit', octicons.zap.toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      return this.graph.currentActionContext() == this.node && this.graph.HEAD() == this.node;
    });
  }

  perform() {
    return this.server
      .postPromise('/reset', { path: this.graph.repoPath(), to: 'HEAD^', mode: 'mixed' })
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

export class Revert extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Revert', 'revert', octicons.history.toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      return this.graph.currentActionContext() == this.node;
    });
  }

  perform() {
    return this.server.postPromise('/revert', {
      path: this.graph.repoPath(),
      commit: this.node.sha1,
    });
  }
}

export class Squash extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Squash', 'squash', octicons.fold.toSVG({ height: 18 }));
    this.node = node;
    this.visible = ko.computed(() => {
      return (
        this.graph.isCurrentActionContextRef() &&
        this.graph.currentActionContext().current() &&
        this.graph.currentActionContext().node() != this.node
      );
    });
  }

  createHoverGraphic() {
    const onto = this.graph.getCurrentActionContextNode();
    if (!onto) return;

    return new SquashViewModel(this.graph, this.node, onto);
  }

  perform() {
    const onto = this.graph.getCurrentActionContextNode();
    if (!onto) return;
    // remove last element as it would be a common ancestor.
    const path = this.graph.nodesEdges.getPathToCommonAncestor(this.node, onto).slice(0, -1);

    if (path.length > 0) {
      // squashing branched out lineage
      // c is checkout with squash target of e, results in staging changes
      // from d and e on top of c
      //
      // a - b - (c)        a - b - (c) - [de]
      //  \           ->     \
      //   d  - <e>           d - <e>
      return this.server.postPromise('/squash', {
        path: this.graph.repoPath(),
        target: this.node.sha1,
      });
    } else {
      // squashing backward from same lineage
      // c is checkout with squash target of a, results in current ref moved
      // to a and staging changes within b and c on top of a
      //
      // <a> - b - (c)       (a) - b - c
      //                ->     \
      //                        [bc]
      return this.graph
        .currentActionContext()
        .moveTo(this.node.sha1, true)
        .then(() =>
          this.server.postPromise('/squash', { path: this.graph.repoPath(), target: onto.sha1 })
        );
    }
  }
}
