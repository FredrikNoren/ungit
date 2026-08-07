const expect = require('expect.js');
const fs = require('fs');
const ko = require('knockout');
const path = require('path');
const vm = require('vm');

describe('graph worktree refs', () => {
  function createRefViewModelClass(args = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../components/graph/git-ref.js'), {
      encoding: 'utf8',
    });
    const navigation = args.navigation || { browseTo: () => {} };
    const sandbox = {
      module: { exports: {} },
      exports: {},
      ungit: {
        logger: {
          warn: () => {},
        },
      },
      require: (name) => {
        if (name === 'knockout') return ko;
        if (name === 'blueimp-md5') return () => ({ toString: () => '1234567890' });
        if (name === 'octicons') {
          return {
            globe: { toSVG: () => '<svg class="globe"></svg>' },
            'git-branch': { toSVG: () => '<svg class="branch"></svg>' },
            tag: { toSVG: () => '<svg class="tag"></svg>' },
          };
        }
        if (name === 'ungit-program-events') return { dispatch: () => {} };
        if (name === 'ungit-components') return { showModal: () => {} };
        if (name === 'ungit-navigation') return navigation;
        if (name === 'ungit-address-parser') return { encodePath: encodeURIComponent };
        if (name === './selectable') {
          return class Selectable {
            constructor(graph) {
              this.selected = ko.computed({
                read() {
                  return graph.currentActionContext() == this;
                },
                write(value) {
                  graph.currentActionContext(value ? this : null);
                },
                owner: this,
              });
            }
          };
        }
        throw new Error(`Unexpected require: ${name}`);
      },
    };
    vm.runInNewContext(source, sandbox);
    return sandbox.module.exports;
  }

  function createGraph(path = '/repos/current', branch = 'main') {
    const posts = [];
    return {
      posts,
      currentActionContext: ko.observable(),
      checkedOutBranch: ko.observable(branch),
      HEADref: () => ({ node: () => {} }),
      repoPath: () => path,
      getRef: () => null,
      server: {
        postPromise: (url, body) => {
          posts.push({ url, body });
          return Promise.resolve({});
        },
        unhandledRejection: () => {},
      },
    };
  }

  function createGraphViewModel(args = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../components/graph/graph.js'), {
      encoding: 'utf8',
    });
    const registered = {};
    const sandbox = {
      window: { innerHeight: 800 },
      ungit: {
        config: {
          numberOfNodesPerLoad: 100,
          numRefsToShow: 10,
        },
        logger: {
          debug: () => {},
        },
      },
      require: (name) => {
        if (name === 'knockout') return ko;
        if (name === 'lodash') {
          return {
            debounce: (fn) => fn,
          };
        }
        if (name === 'moment') return () => ({ valueOf: () => 1 });
        if (name === 'octicons') {
          return {
            search: { toSVG: () => '<svg></svg>' },
            plus: { toSVG: () => '<svg></svg>' },
          };
        }
        if (name === 'ungit-components') {
          return {
            register: (componentName, creator) => {
              registered[componentName] = creator;
            },
          };
        }
        if (name === './git-node') {
          return class GitNodeViewModel {};
        }
        if (name === './git-ref') return createRefViewModelClass();
        if (name === './edge') return class EdgeViewModel {};
        if (name === '../ComponentRoot') {
          return {
            ComponentRoot: class ComponentRoot {
              constructor() {
                this.defaultDebounceOption = {};
              }

              isSamePayload() {
                return false;
              }
            },
          };
        }
        throw new Error(`Unexpected require: ${name}`);
      },
    };
    vm.runInNewContext(source, sandbox);

    const calls = [];
    const server = args.server || {
      getPromise: (url) => {
        calls.push(url);
        if (url === '/gitlog') return Promise.resolve({ nodes: [] });
        if (url === '/checkout') return Promise.resolve('main');
        if (url === '/worktrees') {
          return Promise.resolve([
            { path: '/repos/current', branch: 'main', status: 'clean' },
            { path: '/repos/current-feature-demo', branch: 'feature/demo', status: 'dirty' },
          ]);
        }
        return Promise.resolve({});
      },
      unhandledRejection: () => {},
    };
    const repoPath = args.repoPath || (() => '/repos/current');

    return {
      calls,
      viewModel: registered.graph({ server, repoPath }),
    };
  }

  it('renders a marker for a branch checked out in another worktree', () => {
    const RefViewModel = createRefViewModelClass();
    const ref = new RefViewModel('refs/heads/feature/demo', createGraph());

    ref.worktree({
      path: '/repos/current-feature-demo',
      branch: 'feature/demo',
      status: 'dirty',
    });

    const html = ref.displayHtml();

    expect(html).to.contain('feature/demo');
    expect(html).to.contain('worktree-ref-marker');
    expect(html).to.contain('>current-feature-demo</span>');
    expect(html).to.contain('status-dirty');
    expect(html).to.contain('Checked out in /repos/current-feature-demo');
  });

  it('does not render the other-worktree marker for the current repo path', () => {
    const RefViewModel = createRefViewModelClass();
    const ref = new RefViewModel('refs/heads/main', createGraph('/repos/current', 'main'));

    ref.worktree({
      path: '/repos/current',
      branch: 'main',
      status: 'clean',
    });

    expect(ref.displayHtml()).to.not.contain('worktree-ref-marker');
  });

  it('loads worktrees into matching graph branch refs', async () => {
    const { viewModel } = createGraphViewModel();
    const currentRef = viewModel.getRef('refs/heads/main');
    const featureRef = viewModel.getRef('refs/heads/feature/demo');

    await viewModel._updateWorktrees();

    expect(currentRef.worktree().path).to.be('/repos/current');
    expect(featureRef.worktree().path).to.be('/repos/current-feature-demo');
    expect(featureRef.displayHtml()).to.contain('worktree-ref-marker');
  });

  it('switches to another worktree instead of checking out its branch in the current path', async () => {
    const browsedTo = [];
    const RefViewModel = createRefViewModelClass({
      navigation: {
        browseTo(path) {
          browsedTo.push(path);
        },
      },
    });
    const graph = createGraph('/repos/current', 'main');
    const ref = new RefViewModel('refs/heads/bugfix/hotfix', graph);

    ref.worktree({
      path: '/repos/current-hotfix',
      branch: 'bugfix/hotfix',
      status: 'clean',
    });

    await ref.checkout();

    expect(browsedTo).to.eql(['repository?path=%2Frepos%2Fcurrent-hotfix']);
    expect(graph.posts).to.eql([]);
  });
});
