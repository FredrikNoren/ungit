'use strict';
const winston = require('../source/utils/winston');
const child_process = require('child_process');
const puppeteer = require('puppeteer');
const net = require('net');
const request = require('superagent');
const mkdirp = require('mkdirp');
const util = require('util');
const rimraf = util.promisify(require('rimraf'));
const { encodePath } = require('../source/address-parser');
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
    this.config.showServerOutput =
      this.config.showServerOutput === undefined ? true : this.config.showServerOutput;
    this.config.serverStartupOptions = this.config.serverStartupOptions || [];
    this.shuttinDown = false;
  }

  getRootUrl() {
    return this.rootUrl;
  }

  getPort() {
    const tmpPortrange = portrange + Math.floor(Math.random() * 5000);

    return new Promise((resolve, reject) => {
      const server = net.createServer();

      server.listen({ port: tmpPortrange }, () => {
        server.once('close', () => {
          this.port = tmpPortrange;
          this.rootUrl = `http://127.0.0.1:${this.port}${this.config.rootPath}`;
          resolve();
        });
        server.close();
      });
      server.on('error', () => {
        this.getPort().then(resolve);
      });
    });
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

      await this.getPort();
      await this.startServer();
    } catch (err) {
      winston.error(err);
      throw new Error('Cannot confirm ungit start!!\n' + err);
    }
  }

  startServer() {
    winston.info('Starting ungit server...', this.config.serverStartupOptions);

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
        if (this.config.showServerOutput) winston.verbose(prependLines('[server] ', stdoutStr));

        if (stdoutStr.indexOf('Ungit server already running') >= 0) {
          winston.info('server-already-running');
        }

        if (stdoutStr.indexOf('## Ungit started ##') >= 0) {
          if (this.hasStarted) {
            reject(new Error('Ungit started twice, probably crashed.'));
          } else {
            this.hasStarted = true;
            winston.info('Ungit server started.');
            resolve();
          }
        }
      });
      ungitServer.stderr.on('data', (stderr) => {
        const stderrStr = stderr.toString();
        winston.error(prependLines('[server ERROR] ', stderrStr));
        if (stderrStr.indexOf('EADDRINUSE') > -1) {
          winston.info('retrying with different port');
          ungitServer.kill('SIGINT');
          reject(new Error('EADDRINUSE'));
        }
      });
      ungitServer.on('exit', () => winston.info('UNGIT SERVER EXITED'));
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
      winston.info('Creating temp folder');
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
    await this.createCommits(config, limit, x + 1);
  }

  createTestFile(filename, repoPath) {
    return this.backgroundAction('POST', '/api/testing/createfile', {
      file: filename,
      path: repoPath,
    });
  }

  // browser helpers

  async goto(url) {
    winston.info('Go to page: ' + url);

    if (!this.page) {
      const pages = await this.browser.pages();
      const page = (this.page = pages[0]);

      page.on('console', (message) => {
        const text = `[ui ${message.type()}] ${new Date().toISOString()}  - ${message.text()}}`;

        if (message.type() === 'error' && !this.shuttinDown) {
          winston.error(text);
        } else {
          winston.info(text);
        }
      });
    }

    await this.page.goto(url);
  }

  async openUngit(tempDirPath) {
    await this.goto(`${this.getRootUrl()}/#/repository?path=${encodePath(tempDirPath)}`);
    await this.waitForElementVisible('.repository-actions');
    await this.wait(1000);
  }

  waitForElementVisible(selector) {
    return this.page.waitForSelector(selector, { visible: true });
  }
  waitForElementHidden(selector) {
    return this.page.waitForSelector(selector, { hidden: true });
  }
  wait(duration) {
    return this.page.waitForTimeout(duration);
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
    let elementHandle = await this.waitForElementVisible(selector);
    try {
      await elementHandle.click({ clickCount: clickCount });
    } catch (err1) {
      elementHandle = await this.waitForElementVisible(selector);
      try {
        await elementHandle.click({ clickCount: clickCount }); // try click a second time to reduce test flakiness
      } catch (err2) {
        winston.error(`Failed to click element: ${selector}`);
        throw err2;
      }
    }
  }

  async commit(commitMessage) {
    await this.waitForElementVisible('.files .file .btn-default');
    await this.insert('.staging input.form-control', commitMessage);
    await this.click('.commit-btn');
    await this.waitForElementHidden('.files .file .btn-default');
    await this.wait(1000);
  }

  async _createRef(type, name) {
    await this.click('.current ~ .new-ref button.showBranchingForm');
    await this.insert('.ref-icons.new-ref.editing input', name);
    await this.click(`.new-ref ${type === 'branch' ? '.btn-primary' : '.btn-default'}`);
    await this.waitForElementVisible(`.ref.${type}[data-ta-name="${name}"]`);
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
      });
      await this.click('.modal-dialog .btn-primary');
    } catch (err) {
      /* ignore */
    }
    await this.waitForElementHidden(`[data-ta-action="${action}"]:not([style*="display: none"])`);
  }

  async refAction(ref, local, action) {
    await this.click(`.branch[data-ta-name="${ref}"][data-ta-local="${local}"]`);
    await this.click(`[data-ta-action="${action}"]:not([style*="display: none"]) .dropmask`);
    await this._verifyRefAction(action);
  }

  async moveRef(ref, targetNodeCommitTitle) {
    await this.click(`.branch[data-ta-name="${ref}"]`);
    await this.click(
      `[data-ta-node-title="${targetNodeCommitTitle}"] [data-ta-action="move"]:not([style*="display: none"]) .dropmask`
    );
    await this._verifyRefAction('move');
  }
}
