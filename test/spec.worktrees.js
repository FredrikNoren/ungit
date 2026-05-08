const expect = require('expect.js');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('worktrees component', () => {
  function createObservable(initialValue) {
    let value = initialValue;
    const observable = function (nextValue) {
      if (arguments.length) value = nextValue;
      return value;
    };
    observable.subscribe = () => {};
    return observable;
  }

  function createWorktreesViewModel(args = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../components/worktrees/worktrees.js'), {
      encoding: 'utf8',
    });
    const registered = {};
    const renderCalls = [];
    const shownModals = [];
    const programEvents = {
      dispatched: [],
      dispatch(event) {
        this.dispatched.push(event);
      },
    };
    const navigation = {
      browsedTo: [],
      browseTo(path) {
        this.browsedTo.push(path);
      },
    };
    const sandbox = {
      window: {
        opened: [],
        confirm: () => true,
        open(url) {
          this.opened.push(url);
        },
      },
      ungit: {
        config: {
          fileSeparator: '/',
        },
      },
      require: (name) => {
        if (name === 'knockout') {
          return {
            observable: createObservable,
            observableArray: (initialValue) => createObservable(initialValue),
            computed: (fn) => fn,
            renderTemplate: (...renderArgs) => renderCalls.push(renderArgs),
          };
        }
        if (name === 'ungit-components') {
          return {
            register: (componentName, creator) => {
              registered[componentName] = creator;
            },
            showModal: (modalName, modalArgs) => {
              shownModals.push({ modalName, modalArgs });
            },
          };
        }
        if (name === 'octicons') {
          return {
            'git-branch': {
              toSVG: () => '<svg></svg>',
            },
            'link-external': {
              toSVG: () => '<svg class="link"></svg>',
            },
            x: {
              toSVG: () => '<svg class="x"></svg>',
            },
          };
        }
        if (name === 'ungit-program-events') return programEvents;
        if (name === 'ungit-navigation') return navigation;
        if (name === 'ungit-address-parser') {
          return {
            encodePath: encodeURIComponent,
          };
        }
        throw new Error(`Unexpected require: ${name}`);
      },
    };

    vm.runInNewContext(source, sandbox);
    const server = args.server || {
      getPromise: () => Promise.resolve([]),
      postPromise: () => Promise.resolve({}),
      delPromise: () => Promise.resolve({}),
      unhandledRejection: () => {},
    };
    const repoPath = args.repoPath || (() => '/repos/SleepyCats');

    return {
      viewModel: registered.worktrees({ server, repoPath }),
      renderCalls,
      shownModals,
      programEvents,
      navigation,
      window: sandbox.window,
    };
  }

  it('is exported as an ungit plugin', () => {
    const manifestPath = path.join(__dirname, '../components/worktrees/ungit-plugin.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, { encoding: 'utf8' }));

    expect(manifest.exports.javascript).to.be('worktrees.bundle.js');
    expect(manifest.exports.css).to.be('worktrees.css');
    expect(manifest.exports.knockoutTemplates.worktrees).to.be('worktrees.html');
  });

  it('registers a renderable component view model', () => {
    const { viewModel, renderCalls } = createWorktreesViewModel();

    expect(viewModel.updateNode).to.be.a('function');
    viewModel.updateNode('parent');
    expect(renderCalls[0][0]).to.be('worktrees');
    expect(renderCalls[0][1]).to.be(viewModel);
    expect(renderCalls[0][3]).to.be('parent');
  });

  it('uses the shared bootstrap dropdown behavior', () => {
    const template = fs.readFileSync(
      path.join(__dirname, '../components/worktrees/worktrees.html'),
      {
        encoding: 'utf8',
      }
    );

    expect(template).to.contain('data-toggle="dropdown"');
    expect(template).to.not.contain('css: { open: isOpen }');
    expect(template).to.not.contain('click: toggle');
    expect(template).to.not.contain('event.stopPropagation()');
    expect(template).to.not.contain('worktree-lock');
    expect(template).to.contain('html: $parent.linkIcon');
    expect(template).to.contain('html: $parent.closeIcon');
  });

  it('loads worktrees', async () => {
    const calls = [];
    const { viewModel } = createWorktreesViewModel({
      server: {
        getPromise: (url, args) => {
          calls.push({ url, args });
          return Promise.resolve([{ path: '/repos/SleepyCats', branch: 'main' }]);
        },
      },
    });

    await viewModel.loadWorktrees();

    expect(viewModel.worktrees()).to.eql([{ path: '/repos/SleepyCats', branch: 'main' }]);
    expect(calls).to.eql([{ url: '/worktrees', args: { path: '/repos/SleepyCats' } }]);
  });

  it('identifies the current worktree', () => {
    const { viewModel } = createWorktreesViewModel();

    expect(viewModel.isCurrentWorktree({ path: '/repos/SleepyCats' })).to.be(true);
    expect(viewModel.isCurrentWorktree({ path: '/repos/SleepyCats-feature' })).to.be(false);
  });

  it('treats absent locked values as unlocked', async () => {
    const calls = [];
    const { viewModel } = createWorktreesViewModel({
      server: {
        getPromise: () => Promise.resolve([]),
        postPromise: (url, body) => {
          calls.push({ url, body });
          return Promise.resolve({});
        },
      },
    });

    await viewModel.toggleLock({ path: '/repos/SleepyCats-feature' });

    expect(calls).to.eql([
      {
        url: '/worktrees/lock',
        body: {
          path: '/repos/SleepyCats',
          worktreePath: '/repos/SleepyCats-feature',
          lock: true,
        },
      },
    ]);
  });

  it('confirms worktree removal with the shared modal', async () => {
    const calls = [];
    const { viewModel, shownModals } = createWorktreesViewModel({
      server: {
        getPromise: (url, args) => {
          calls.push({ method: 'get', url, args });
          return Promise.resolve([]);
        },
        delPromise: (url, args) => {
          calls.push({ method: 'del', url, args });
          return Promise.resolve({});
        },
      },
    });

    viewModel.removeWorktree({ path: '/repos/SleepyCats-feature' });

    expect(calls).to.eql([]);
    expect(shownModals.length).to.be(1);
    expect(shownModals[0].modalName).to.be('yesnomodal');
    expect(shownModals[0].modalArgs.title).to.be('Are you sure?');
    expect(shownModals[0].modalArgs.details).to.be(
      'Removing /repos/SleepyCats-feature worktree cannot be undone with ungit.'
    );

    shownModals[0].modalArgs.closeFunc(false);
    expect(calls).to.eql([]);

    await shownModals[0].modalArgs.closeFunc(true);
    expect(calls).to.eql([
      {
        method: 'del',
        url: '/worktrees',
        args: {
          path: '/repos/SleepyCats',
          worktreePath: '/repos/SleepyCats-feature',
        },
      },
      {
        method: 'get',
        url: '/worktrees',
        args: { path: '/repos/SleepyCats' },
      },
    ]);
  });

  it('opens the worktree create modal from graph create-worktree events', () => {
    const { viewModel, shownModals } = createWorktreesViewModel();

    viewModel.onProgramEvent({ event: 'create-worktree', branch: 'feature/demo' });

    expect(shownModals).to.eql([
      {
        modalName: 'addworktreemodal',
        modalArgs: {
          path: '/repos/SleepyCats',
          branch: 'feature/demo',
          worktreePath: '/repos/SleepyCats-feature-demo',
          createBranch: true,
        },
      },
    ]);
  });
});
