const ko = require('knockout');
const _ = require('lodash');
const octicons = require('octicons');
const components = require('ungit-components');
const GitNodeViewModel = require('./git-node');
const GitRefViewModel = require('./git-ref');
const { ComponentRoot } = require('../ComponentRoot');
const numberOfNodesPerLoad = ungit.config.numberOfNodesPerLoad;
const { NodesEdges } = require('./nodes-edges');

components.register('graph', (args) => new GraphViewModel(args.server, args.repoPath));

class GraphViewModel extends ComponentRoot {
  constructor(server, repoPath) {
    super();
    this.nodesEdges = new NodesEdges(this);
    this._isLoadNodesFromApiRunning = false;
    this.updateBranches = _.debounce(this._updateBranches, 250, this.defaultDebounceOption);
    this.loadNodesFromApi = _.debounce(this._loadNodesFromApi, 250, this.defaultDebounceOption);
    this.repoPath = repoPath;
    this.limit = ko.observable(numberOfNodesPerLoad);
    this.skip = ko.observable(0);
    this.server = server;
    this.currentRemote = ko.observable();
    this.refs = ko.observableArray().extend({ rateLimit: 500 });
    this.refsByRefName = {};
    this.isActionRunning = ko.observable(false);
    this.checkedOutBranch = ko.observable();
    this.checkedOutRef = ko.computed(() =>
      this.checkedOutBranch() ? this.getRef(`refs/heads/${this.checkedOutBranch()}`) : null
    );
    this.HEADref = ko.observable();
    this.HEAD = ko.computed(() => (this.HEADref() ? this.HEADref().node() : undefined));
    this.commitNodeColor = ko.computed(() => (this.HEAD() ? this.HEAD().color() : '#4A4A4A'));
    this.commitNodeEdge = ko.computed(() => {
      if (!this.HEAD() || !this.HEAD().cx() || !this.HEAD().cy()) return;
      return `M 610 68 L ${this.HEAD().cx()} ${this.HEAD().cy()}`;
    });
    this.showCommitNode = ko.observable(false);
    this.currentActionContext = ko.observable();
    this.scrolledToEnd = _.debounce(
      () => {
        this.limit(numberOfNodesPerLoad + this.limit());
        this.loadNodesFromApi();
      },
      500,
      true
    );
    this.loadAhead = _.debounce(
      () => {
        if (this.skip() <= 0) return;
        this.skip(Math.max(this.skip() - numberOfNodesPerLoad, 0));
        this.loadNodesFromApi();
      },
      500,
      true
    );
    this.commitOpacity = ko.observable(1.0);
    this.hoverGraphActionGraphic = ko.observable();
    this.hoverGraphActionGraphic.subscribe(
      (value) => {
        if (value && value.destroy) value.destroy();
      },
      null,
      'beforeChange'
    );

    this.hoverGraphAction = ko.observable();
    this.hoverGraphAction.subscribe((value) => {
      if (value && value.createHoverGraphic) {
        this.hoverGraphActionGraphic(value.createHoverGraphic());
      } else {
        this.hoverGraphActionGraphic(null);
      }
    });

    this.loadNodesFromApi();
    this.updateBranches();
    this.graphWidth = ko.observable();
    this.graphHeight = ko.observable(800);
    this.searchIcon = octicons.search.toSVG({ height: 18 });
    this.plusIcon = octicons.plus.toSVG({ height: 18 });
  }

  updateNode(parentElement) {
    ko.renderTemplate('graph', this, {}, parentElement);
  }

  getRef(ref, constructIfUnavailable) {
    if (constructIfUnavailable === undefined) constructIfUnavailable = true;
    let refViewModel = this.refsByRefName[ref];
    if (!refViewModel && constructIfUnavailable) {
      refViewModel = this.refsByRefName[ref] = new GitRefViewModel(ref, this);
      this.refs.push(refViewModel);
      if (refViewModel.name === 'HEAD') {
        this.HEADref(refViewModel);
      }
    }
    return refViewModel;
  }

  async _loadNodesFromApi() {
    this._isLoadNodesFromApiRunning = true;
    ungit.logger.debug('graph.loadNodesFromApi() triggered');
    const nodes = this.nodesEdges.nodes();
    const nodeSize = nodes.length;

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

      if (nodes.length > 0) {
        this.graphHeight(nodes[nodes.length - 1].cy() + 80);
      }
      this.graphWidth(1000 + this.nodesEdges.heighstBranchOrder * 90);
    } catch (e) {
      this.server.unhandledRejection(e);
    } finally {
      if (window.innerHeight - this.graphHeight() > 0 && nodeSize != nodes.length) {
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
    if (this.currentActionContext() && this.currentActionContext() instanceof GitNodeViewModel) {
      this.currentActionContext().toggleSelected();
    } else {
      this.currentActionContext(null);
    }
    // If the click was on an input element, then let's allow the default action to proceed.
    // This is especially needed since for some strange reason any submit (ie. enter in a textbox)
    // will trigger a click event on the submit input of the form, which will end up here,
    // and if we don't return true, then the submit event is never fired, breaking stuff.
    if (event.target.nodeName === 'INPUT') return true;
  }

  onProgramEvent(event) {
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

  updateAnimationFrame(deltaT) {
    this.nodesEdges.nodes().forEach((node) => {
      node.updateAnimationFrame(deltaT);
    });
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
    this.refs().forEach((ref) => {
      // tag is removed from another source
      if (ref.isRemoteTag && (!ref.version || ref.version < version)) {
        ref.remove(true);
      }
    });
  }

  checkHeadMove(toNode) {
    if (this.HEAD() === toNode) {
      this.HEADref().node(toNode);
    }
  }
}

module.exports = GraphViewModel;
