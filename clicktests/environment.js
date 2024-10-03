'use strict';
const logger = require('../source/utils/logger');
const child_process = require('child_process');
const puppeteer = require('puppeteer');
const request = require('superagent');
const mkdirp = require('mkdirp').mkdirp;
const rimraf = require('rimraf').rimraf;
const { encodePath } = require('../source/address-parser');
const portfinder = require('portfinder');
const portrange = 45032;

module.exports = (config) => new Environment(config);

const prependLines = (pre, text) => {
  return text
    .split('\n')
    .filter((l) => l)
    .map((line) => pre + line)
    .join('\n');
};

// Environment provides
class Environment {
  constructor(config) {
    this.config = config || {};
    this.config.rootPath = typeof this.config.rootPath === 'string' ? this.config.rootPath : '';
    this.config.serverTimeout = this.config.serverTimeout || 35000;
    this.config.headless = this.config.headless === undefined ? true : this.config.headless;
    this.config.viewWidth = 1920;
    this.config.viewHeight = 1080;
    this.config.serverStartupOptions = this.config.serverStartupOptions || [];
    this.shuttinDown = false;
  }

  getRootUrl() {
    return this.rootUrl;
  }

  async init() {
    try {
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        defaultViewport: {
          width: this.config.viewWidth,
          height: this.config.viewHeight,
        },
      });
      await this.startServer();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      logger.error(err);
      throw new Error('Cannot confirm ungit start!!\n' + err);
    }
  }

  async startServer() {
    this.port = await portfinder.getPortPromise({ port: portrange });
    this.rootUrl = `http://127.0.0.1:${this.port}${this.config.rootPath}`;
    logger.info(`Starting ungit server:${this.port} with ${this.config.serverStartupOptions}`);

    this.hasStarted = false;
    const options = [
      'bin/ungit',
      '--cliconfigonly',
      `--port=${this.port}`,
      `--rootPath=${this.config.rootPath}`,
      '--no-launchBrowser',
      '--dev',
      '--no-bugtracking',
      `--autoShutdownTimeout=${this.config.serverTimeout}`,
      '--logLevel=debug',
      '--maxNAutoRestartOnCrash=0',
      '--no-autoCheckoutOnBranchCreate',
      '--alwaysLoadActiveBranch',
      `--numRefsToShow=${this.config.numRefsToShow || 5}`,
    ].concat(this.config.serverStartupOptions);

    const ungitServer = (this.ungitServerProcess = child_process.spawn('node', options));

    return new Promise((resolve, reject) => {
      ungitServer.stdout.on('data', (stdout) => {
        const stdoutStr = stdout.toString();
        console.log(prependLines('[server] ', stdoutStr));

        if (stdoutStr.indexOf('Ungit server already running') >= 0) {
          logger.info('server-already-running');
        }

        if (stdoutStr.indexOf('## Ungit started ##') >= 0) {
          if (this.hasStarted) {
            reject(new Error('Ungit started twice, probably crashed.'));
          } else {
            this.hasStarted = true;
            logger.info('Ungit server started.');
            resolve();
          }
        }
      });
      ungitServer.stderr.on('data', (stderr) => {
        const stderrStr = stderr.toString();
        logger.error(prependLines('[server ERROR] ', stderrStr));
        if (stderrStr.indexOf('EADDRINUSE') > -1) {
          logger.info('retrying with different port');
          ungitServer.kill('SIGINT');
          reject(new Error('EADDRINUSE'));
        }
      });
      ungitServer.on('exit', () => logger.info('UNGIT SERVER EXITED'));
    });
  }

  async shutdown() {
    this.shuttinDown = true;

    await this.backgroundAction('POST', '/api/testing/cleanup');

    if (this.ungitServerProcess) {
      this.ungitServerProcess.kill('SIGINT');
      this.ungitServerProcess = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  // server helpers

  async backgroundAction(method, url, body) {
    url = this.getRootUrl() + url;

    let req;
    if (method === 'GET') {
      req = request.get(url).withCredentials().query(body);
    } else if (method === 'POST') {
      req = request.post(url).send(body);
    } else if (method === 'DELETE') {
      req = request.delete(url).send(body);
    }

    req.set({ encoding: 'utf8', 'cache-control': 'no-cache', 'Content-Type': 'application/json' });

    const response = await req;
    return response.body;
  }

  async createRepos(testRepoPaths, config) {
    for (let i = 0; i < config.length; i++) {
      const conf = config[i];
      conf.bare = !!conf.bare;
      await this.initRepo(conf);
      await this.createCommits(conf, conf.initCommits);
      testRepoPaths.push(conf.path);
    }
  }

  async initRepo(options) {
    if (options.path) {
      await rimraf(options.path);
      await mkdirp(options.path);
    } else {
      logger.info('Creating temp folder');
      options.path = await this.createTempFolder();
    }
    await this.backgroundAction('POST', '/api/init', options);
  }

  async createTempFolder() {
    const res = await this.backgroundAction('POST', '/api/testing/createtempdir');
    return res.path;
  }

  async createCommits(config, limit, x) {
    x = x || 0;
    if (!limit || limit < 0 || x === limit) return;

    await this.createTestFile(`${config.path}/testy${x}`);
    await this.backgroundAction('POST', '/api/commit', {
      path: config.path,
      message: `Init Commit ${x}`,
      files: [{ name: `testy${x}` }],
    });
    // `createCommits()` is used at create repo `this.page` may not be inited
    await this.createCommits(config, limit, x + 1);
  }

  async createTestFile(filename, repoPath) {
    await this.backgroundAction('POST', '/api/testing/createfile', {
      file: filename,
      path: repoPath,
    });
  }

  // browser helpers

  async goto(url) {
    logger.info('Go to page: ' + url);

    if (!this.page) {
      const pages = await this.browser.pages();
      this.page = pages[0];
      this.page.on('console', (message) => {
        const text = `[ui ${message.type()}] ${message.text()}`;

        if (message.type() === 'error' && !this.shuttinDown) {
          const stackTraceString = message
            .stackTrace()
            .map((trace) => `\t${trace.lineNumber}: ${trace.url}`)
            .join('\n');
          logger.error(text, stackTraceString);
        } else {
          // text already has timestamp and etc as it is generated by logger as well.
          console.log(text);
        }
      });
    }

    await this.page.goto(url);
  }

  async openUngit(tempDirPath) {
    await this.goto(`${this.getRootUrl()}/#/repository?path=${encodePath(tempDirPath)}`);
    await this.waitForElementVisible('.repository-actions');
    await this.page.waitForNetworkIdle();
  }

  waitForElementVisible(selector, timeout) {
    logger.debug(`Waiting for visible: "${selector}"`);
    return this.page.waitForSelector(selector, { visible: true, timeout: timeout || 6000 });
  }
  waitForElementHidden(selector, timeout) {
    logger.debug(`Waiting for hidden: "${selector}"`);
    return this.page.waitForSelector(selector, { hidden: true, timeout: timeout || 6000 });
  }
  wait(duration) {
    return new Promise((resolve) => setTimeout(resolve, duration));
  }

  type(text) {
    return this.page.keyboard.type(text);
  }
  async insert(selector, text) {
    await this.waitForElementVisible(selector);
    await this.page.$eval(selector, (ele) => (ele.value = ''));
    await this.page.focus(selector);
    await this.type(text);
  }
  press(key) {
    return this.page.keyboard.press(key);
  }

  async click(selector, clickCount) {
    logger.info(`clicking "${selector}"`);

    for (let i = 0; i < 3; i++) {
      try {
        const toClick = await this.waitForElementVisible(selector);
        await this.wait(200);
        await toClick.click({ delay: 100, clickCount: clickCount });
        break;
      } catch (err) {
        logger.error('error while clicking', err);
      }
    }
    logger.info(`clicked "${selector}`);
  }

  waitForBranch(branchName) {
    const currentBranch = 'document.querySelector(".ref.branch.current")';
    return this.page.waitForFunction(
      `${currentBranch} && ${currentBranch}.innerText && ${currentBranch}.innerText.trim() === "${branchName}"`,
      { polling: 250 }
    );
  }

  async commit(commitMessage) {
    await this.waitForElementVisible('.files .file .btn-default');
    await this.insert('.staging input.form-control', commitMessage);
    const postCommitProm = this.setApiListener('/commit', 'POST');
    await this.click('.commit-btn');
    await postCommitProm;
    await this.waitForElementHidden('.files .file .btn-default');
  }

  async _createRef(type, name) {
    await this.click('.current ~ .new-ref button.showBranchingForm');
    await this.insert('.ref-icons.new-ref.editing input', name);
    await this.wait(500);
    const createRefProm =
      type === 'branch'
        ? this.setApiListener('/branches', 'POST')
        : this.setApiListener('/tags', 'POST');
    await this.click(`.new-ref ${type === 'branch' ? '.btn-primary' : '.btn-default'}`);
    await createRefProm;
    await this.waitForElementVisible(`.ref.${type}[data-ta-name="${name}"]`);
    await this.ensureRedraw();
  }
  createTag(name) {
    return this._createRef('tag', name);
  }
  createBranch(name) {
    return this._createRef('branch', name);
  }

  async _verifyRefAction(action) {
    try {
      await this.page.waitForSelector('.modal-dialog .btn-primary', {
        visible: true,
        timeout: 2000,
      }); // not all ref actions opens dialog, this line may throw exception.
      await this.awaitAndClick('.modal-dialog .btn-primary');
    } catch {
      /* ignore */
    }
    await this.waitForElementHidden(`[data-ta-action="${action}"]:not([style*="display: none"])`);
    await this.ensureRedraw();
  }

  async _refAction(ref, local, action, validateFunc) {
    if (!this[`_${action}ResponseWatcher`]) {
      this.page.on('response', async (response) => {
        const url = response.url();
        const method = response.request().method();

        if (validateFunc(url, method)) {
          this.page.evaluate(`ungit._${action}Response = true`);
        }
      });
      this[`_${action}ResponseWatcher`] = true;
    }
    await this.clickOnNode(`.branch[data-ta-name="${ref}"][data-ta-local="${local}"]`);
    await this.click(`[data-ta-action="${action}"]:not([style*="display: none"]) .dropmask`);
    await this._verifyRefAction(action);
    await this.page.waitForFunction(`ungit._${action}Response`, { polling: 250 });
    await this.page.evaluate(`ungit._${action}Response = undefined`);
  }

  async pushRefAction(ref, local) {
    await this._refAction(ref, local, 'push', (url, method) => {
      if (method !== 'POST') {
        return false;
      }
      if (
        url.indexOf('/push') === -1 &&
        url.indexOf('/tags') === -1 &&
        url.indexOf('/branches') === -1
      ) {
        return false;
      }
      return true;
    });
  }

  async rebaseRefAction(ref, local) {
    await this._refAction(ref, local, 'rebase', (url, method) => {
      return method === 'POST' && url.indexOf('/rebase') >= -1;
    });
  }

  async mergeRefAction(ref, local) {
    await this._refAction(ref, local, 'merge', (url, method) => {
      return method === 'POST' && url.indexOf('/merge') >= -1;
    });
  }

  async moveRef(ref, targetNodeCommitTitle) {
    await this.clickOnNode(`.branch[data-ta-name="${ref}"]`);
    if (!this._isMoveResponseWatcherSet) {
      this.page.on('response', async (response) => {
        const url = response.url();
        if (response.request().method() !== 'POST') {
          return;
        }
        if (
          url.indexOf('/reset') === -1 &&
          url.indexOf('/tags') === -1 &&
          url.indexOf('/branches') === -1
        ) {
          return;
        }
        this.page.evaluate('ungit._moveEventResponded = true');
      });
      this._isMoveResponseWatcherSet = true;
    }
    await this.click(
      `[data-ta-node-title="${targetNodeCommitTitle}"] [data-ta-action="move"]:not([style*="display: none"]) .dropmask`
    );
    await this._verifyRefAction('move');
    await this.page.waitForFunction('ungit._moveEventResponded', { polling: 250 });
    await this.page.evaluate('ungit._moveEventResponded = undefined');
  }

  // Explicitly trigger two program events.
  // Usually these events are triggered by mouse movements, or api calls
  // and etc.  This function is to help mimic those movements.
  triggerProgramEvents() {
    return this.page.evaluate(() => {
      const isActive = ungit.programEvents.active;
      if (!isActive) {
        ungit.programEvents.active = true;
      }
      ungit.programEvents.dispatch({ event: 'working-tree-changed' });
      if (!isActive) {
        ungit.programEvents.active = false;
      }
    });
  }

  async ensureRedraw() {
    logger.debug('ensureRedraw triggered');
    if (!this._gitlogResposneWatcher) {
      this.page.on('response', async (response) => {
        if (response.url().indexOf('/gitlog') > 0 && response.request().method() === 'GET') {
          this.page.evaluate('ungit._gitlogResponse = true');
        }
      });
      this._gitlogResposneWatcher = true;
    }
    await this.page.evaluate('ungit._gitlogResponse = undefined');
    await this.triggerProgramEvents();
    await this.page.waitForFunction('ungit._gitlogResponse', { polling: 250 });
    await this.page.waitForFunction(
      'ungit.__app.content().repository().graph._isLoadNodesFromApiRunning === false',
      { polling: 250 }
    );
    logger.debug('ensureRedraw finished');
  }

  async awaitAndClick(selector, time = 1000) {
    await this.wait(time);
    await this.click(selector);
  }

  // After a click on `git-node` or `git-ref`, ensure `currentActionContext` is set
  async clickOnNode(nodeSelector) {
    await this.awaitAndClick(nodeSelector);
    await this.page.waitForFunction(
      () => {
        const app = ungit.__app;
        if (!app) {
          return;
        }
        const path = app.content();
        if (!path || path.constructor.name !== 'PathViewModel') {
          return;
        }
        const repository = path.repository();
        if (!repository) {
          return;
        }
        const graph = repository.graph;
        if (!graph) {
          return;
        }
        return graph.currentActionContext();
      },
      { polling: 250 }
    );
    logger.debug(`clickOnNode ${nodeSelector} finished`);
  }

  // If an api call matches `apiPart` and `method` is called, set the `globalVarName`
  // to true. Use for detect if an API call was made and responded.
  setApiListener(apiPart, method, bodyMatcher = () => true) {
    const randomVariable = `ungit._${Math.floor(Math.random() * 500000)}`;
    this.page.on(
      'response',
      async (response) => {
        if (response.url().indexOf(apiPart) > -1 && response.request().method() === method) {
          if (bodyMatcher(await response.json())) {
            // reponse body matcher is matched, set the value to true
            this.page.evaluate(`${randomVariable} = true`);
          }
        }
      },
      { polling: 250 }
    );
    return this.page
      .waitForFunction(`${randomVariable} === true`, { polling: 250 })
      .then(() => this.page.evaluate(`${randomVariable} = undefined`));
  }
}
