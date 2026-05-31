const ko = require('knockout');
const octicons = require('octicons');
const components = require('ungit-components');
const navigation = require('ungit-navigation');
const { encodePath } = require('ungit-address-parser');

class WorktreesViewModel {
  constructor(server, repoPath) {
    this.server = server;
    this.repoPath = repoPath;
    this.worktrees = ko.observableArray([]);
    this.isLoading = ko.observable(false);
    this.error = ko.observable();
    this.worktreeCount = ko.computed(() => (this.worktrees() || []).length);
    this.hasWorktrees = ko.computed(() => this.worktreeCount() > 0);
    this.branchIcon = octicons['git-branch'].toSVG({ height: 18 });
    this.linkIcon = octicons['link-external'].toSVG({ height: 18 });
    this.closeIcon = octicons.x.toSVG({ height: 18 });
  }

  loadWorktrees() {
    this.isLoading(true);
    this.error(null);
    return this.server
      .getPromise('/worktrees', { path: this.repoPath() })
      .then((worktrees) => {
        this.worktrees(worktrees || []);
      })
      .catch((e) => {
        this.error(e.errorSummary || e.message || 'Unable to load worktrees');
      })
      .finally(() => {
        this.isLoading(false);
      });
  }

  onProgramEvent(event) {
    if (event.event === 'create-worktree') {
      this.openCreateForm(event.branch);
    } else if (event.event === 'worktree-changed' || event.event === 'git-directory-changed') {
      this.loadWorktrees();
    }
  }

  openCreateForm(branch) {
    const branchName = branch || '';
    components.showModal('addworktreemodal', {
      path: this.repoPath(),
      branch: branchName,
      worktreePath: this.defaultWorktreePath(branchName || 'worktree'),
      createBranch: true,
    });
  }

  defaultWorktreePath(branch) {
    const repoPath = this.repoPath();
    const separator = (ungit.config && ungit.config.fileSeparator) || '/';
    const normalizedPath = repoPath.replace(/\\/g, '/');
    const slashIndex = normalizedPath.lastIndexOf('/');
    const parentPath = slashIndex >= 0 ? repoPath.slice(0, slashIndex) : '.';
    const repoName = slashIndex >= 0 ? normalizedPath.slice(slashIndex + 1) : normalizedPath;
    const safeBranchName = branch.replace(/[\\/\s]+/g, '-');
    return `${parentPath}${separator}${repoName}-${safeBranchName}`;
  }

  switchToWorktree(worktree) {
    navigation.browseTo(`repository?path=${encodePath(worktree.path)}`);
  }

  openInNewTab(worktree) {
    const rootPath = (ungit.config && ungit.config.rootPath) || '';
    window.open(`${rootPath}/#/repository?path=${encodePath(worktree.path)}`, '_blank');
  }

  toggleLock(worktree) {
    return this.server
      .postPromise('/worktrees/lock', {
        path: this.repoPath(),
        worktreePath: worktree.path,
        lock: !worktree.locked,
      })
      .then(() => this.loadWorktrees())
      .catch((e) => {
        this.error(e.errorSummary || e.message || 'Unable to update worktree lock');
      });
  }

  removeWorktree(worktree) {
    components.showModal('yesnomodal', {
      title: 'Are you sure?',
      details: `Removing ${worktree.path} worktree cannot be undone with ungit.`,
      closeFunc: (isYes) => {
        if (!isYes) return Promise.resolve();
        return this.server
          .delPromise('/worktrees', {
            path: this.repoPath(),
            worktreePath: worktree.path,
          })
          .then(() => this.loadWorktrees())
          .catch((e) => {
            this.error(e.errorSummary || e.message || 'Unable to remove worktree');
          });
      },
    });
  }

  statusLabel(worktree) {
    return worktree.status || 'unknown';
  }

  branchLabel(worktree) {
    return worktree.branch || 'detached';
  }

  isCurrentWorktree(worktree) {
    return this.normalizePath(worktree.path) === this.normalizePath(this.repoPath());
  }

  normalizePath(path) {
    return (path || '').replace(/\\/g, '/').replace(/\/+$/, '');
  }

  updateNode(parentElement) {
    ko.renderTemplate('worktrees', this, {}, parentElement);
  }
}

components.register('worktrees', (args) => new WorktreesViewModel(args.server, args.repoPath));
