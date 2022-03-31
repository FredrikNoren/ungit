import * as ko from 'knockout';
import { AbstractGraph } from "./abstract-graph";
import { NodeViewModel, RefViewModel } from "./git-elements";
import { NodesEdges } from "./nodes-edges";

const _ = require('lodash');
const octicons = require('octicons');

declare const ungit: any;
const components = ungit.components;
const numberOfNodesPerLoad = ungit.config.numberOfNodesPerLoad;

components.register('graph', (args: Record<string, any>) => new GraphViewModel(args.server, args.repoPath));

class GraphViewModel extends AbstractGraph {
  _isLoadNodesFromApiRunning = false;
  updateBranches: () => Promise<any>
  loadNodesFromApi: () => Promise<any>

  currentActionContext = ko.observable();
  HEADref = ko.observable();
  HEAD = ko.computed(() => (this.HEADref() ? this.HEADref().node() : undefined));
  checkedOutBranch: ko.Observable<string> = ko.observable()
  currentRemote: ko.Observable<string> = ko.observable();
  refsByRefName: Record<string, RefViewModel> = {};
  commitOpacity = ko.observable(1.0);
  nodesEdges = new NodesEdges(this);

  isActionRunning = ko.observable(false);

  limit = ko.observable(numberOfNodesPerLoad);
  skip = ko.observable(0);
  commitNodeColor = ko.computed(() => (this.HEAD() ? this.HEAD().color() : '#4A4A4A'));
  commitNodeEdge = ko.computed(() => {
    if (!this.HEAD() || !this.HEAD().cx() || !this.HEAD().cy()) return;
    return `M 610 68 L ${this.HEAD().cx()} ${this.HEAD().cy()}`;
  });
  hoverGraphActionGraphic = ko.observable();
  hoverGraphAction = ko.observable();
  graphWidth = ko.observable(0);
  graphHeight = ko.observable(800);
  searchIcon = octicons.search.toSVG({ height: 18 });
  plusIcon = octicons.plus.toSVG({ height: 18 });

  checkedOutRef = ko.computed(() =>
    this.checkedOutBranch() ? this.getRef(`refs/heads/${this.checkedOutBranch()}`) : null
  );

  scrolledToEnd = _.debounce(
    () => {
      this.limit(numberOfNodesPerLoad + this.limit());
      this.loadNodesFromApi();
    },
    500,
    true
  );
  loadAhead = _.debounce(
    () => {
      if (this.skip() <= 0) return;
      this.skip(Math.max(this.skip() - numberOfNodesPerLoad, 0));
      this.loadNodesFromApi();
    },
    500,
    true
  );

  constructor(server: any, repoPath: ko.Observable<string>) {
    super();
    this.server = server;
    this.repoPath = repoPath;

    this.updateBranches = _.debounce(this._updateBranches, 250, this.defaultDebounceOption);
    this.loadNodesFromApi = _.debounce(this._loadNodesFromApi, 250, this.defaultDebounceOption);

    this.hoverGraphActionGraphic.subscribe(
      (value) => {
        if (value && value.destroy) value.destroy();
      },
      null,
      'beforeChange'
    );
    this.hoverGraphAction.subscribe((value) => {
      const hoverGraphic = value.createHoverGraphic();
      if (value && value.createHoverGraphic && this.hoverGraphActionGraphic() !== hoverGraphic) {
        this.hoverGraphActionGraphic(hoverGraphic);
      } else if (this.hoverGraphActionGraphic() !== null) {
        this.hoverGraphActionGraphic(null);
      }
    });

    this.loadNodesFromApi();
    this.updateBranches();
  }

  updateNode(parentElement) {
    ko.renderTemplate('graph', this, {}, parentElement);
  }

  getRef(ref: string, constructIfUnavailable = undefined): RefViewModel {
    if (constructIfUnavailable === undefined) constructIfUnavailable = true;
    let refViewModel = this.refsByRefName[ref];
    if (!refViewModel && constructIfUnavailable) {
      refViewModel = this.refsByRefName[ref] = new RefViewModel(ref, this);
      if (refViewModel.name === 'HEAD') {
        this.HEADref(refViewModel);
      }
    }
    return refViewModel;
  }

  async _loadNodesFromApi() {
    this._isLoadNodesFromApiRunning = true;
    ungit.logger.debug('graph.loadNodesFromApi() triggered');
    const nodeSize = this.nodesEdges.nodes().length;

    try {
      const log = await this.server.getPromise('/gitlog', {
        path: this.repoPath(),
        limit: this.limit(),
        skip: this.skip(),
      });
      if (this.isSamePayload(log)) {
        return;
      }

      this.nodesEdges.processGitLog(log);
      const nodes = this.nodesEdges.nodes();

      if (nodes.length > 0) {
        this.graphHeight(nodes[nodes.length - 1].cy() + 80);
      }
      this.graphWidth(1000 + this.nodesEdges.heighstBranchOrder * 90);
    } catch (e) {
      this.server.unhandledRejection(e);
    } finally {
      if (window.innerHeight - this.graphHeight() > 0 && nodeSize != this.nodesEdges.nodes().length) {
        this.scrolledToEnd();
      }
      this._isLoadNodesFromApiRunning = false;
      ungit.logger.debug('graph.loadNodesFromApi() finished');
    }
  }

  handleBubbledClick(elem, event) {
    // If the clicked element is bound to the current action context,
    // then let's not deselect it.
    if (ko.dataFor(event.target) === this.currentActionContext()) return;
    if (this.currentActionContext() && this.currentActionContext() instanceof NodeViewModel) {
      this.currentActionContext().toggleSelected();
    } else if (this.currentActionContext() !== null) {
      this.currentActionContext(null);
    }
    // If the click was on an input element, then let's allow the default action to proceed.
    // This is especially needed since for some strange reason any submit (ie. enter in a textbox)
    // will trigger a click event on the submit input of the form, which will end up here,
    // and if we don't return true, then the submit event is never fired, breaking stuff.
    if (event.target.nodeName === 'INPUT') return true;
  }

  onProgramEvent(event: Record<string, any>) {
    if (event.event == 'git-directory-changed' || event.event === 'working-tree-changed') {
      this.loadNodesFromApi();
      this.updateBranches();
    } else if (event.event == 'request-app-content-refresh') {
      this.loadNodesFromApi();
    } else if (event.event == 'remote-tags-update') {
      this.setRemoteTags(event.tags);
    } else if (event.event == 'current-remote-changed') {
      this.currentRemote(event.newRemote);
    } else if (event.event == 'graph-render') {
      this.nodesEdges.nodes().forEach((node) => {
        node.render();
      });
    } else if (event.event === 'modal-close-dialog') {
      this.isActionRunning(false);
    }
  }

  async _updateBranches() {
    const checkout = await this.server.getPromise('/checkout', { path: this.repoPath() });

    try {
      ungit.logger.debug('setting checkedOutBranch', checkout);
      this.checkedOutBranch(checkout);
    } catch (err) {
      if (err.errorCode != 'not-a-repository') {
        this.server.unhandledRejection(err);
      } else {
        ungit.logger.warn('updateBranches failed', err);
      }
    }
  }

  setRemoteTags(remoteTags) {
    const version = Date.now();

    const sha1Map = {}; // map holding true sha1 per tags
    remoteTags.forEach((tag) => {
      if (tag.name.includes('^{}')) {
        // This tag is a dereference tag, use this sha1.
        const tagRef = tag.name.slice(0, tag.name.length - '^{}'.length);
        sha1Map[tagRef] = tag.sha1;
      } else if (!sha1Map[tag.name]) {
        // If sha1 wasn't previously set, use this sha1
        sha1Map[tag.name] = tag.sha1;
      }
    });

    remoteTags.forEach((ref) => {
      if (!ref.name.includes('^{}')) {
        const name = `remote-tag: ${ref.remote}/${ref.name.split('/')[2]}`;
        this.getRef(name).node(this.nodesEdges.getNode(sha1Map[ref.name]));
        this.getRef(name).version = version;
      }
    });
    Object.values(this.refsByRefName).forEach((ref) => {
      // tag is removed from another source
      if (ref.isRemoteTag && (!ref.version || ref.version < version)) {
        ref.remove(true);
      }
    });
  }

  checkHeadMove(toNode: NodeViewModel) {
    if (this.HEAD() === toNode) {
      this.HEADref().node(toNode);
    }
  }

  isCurrentActionContextRef() {
    return this.currentActionContext() instanceof RefViewModel;
  }

  isCurrentActionContextNode() {
    return this.currentActionContext() instanceof NodeViewModel;
  }

  getCurrentActionContextNode() {
    if (this.isCurrentActionContextRef()) {
      return this.currentActionContext().node();
    } else if (this.isCurrentActionContextNode()) {
      return this.currentActionContext();
    } else {
      return undefined;
    }
  }
}

module.exports = GraphViewModel;
