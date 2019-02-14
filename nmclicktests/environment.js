'use strict';
const winston = require('winston');
const child_process = require('child_process');
const Bluebird = require('bluebird');
const Nightmare = require('nightmare');
const net = require('net');
const request = require('superagent');
const mkdirp = Bluebird.promisifyAll(require("mkdirp")).mkdirPAsync;
const rimraf = Bluebird.promisify(require("rimraf"));
const portrange = 45032;
let rootUrl;

module.exports = (config) => new Environment(config);

Nightmare.action('ug', {
  'log': function(message, done) {
    winston.info(`>>> ${message}`);
    done();
  },
  'commit': function(commitMessage, done) {
    this.wait('.files .file .btn-default')
      .insert('.staging input.form-control', commitMessage)
      .wait(100)
      .ug.click('.commit-btn')
      .ug.waitForElementNotVisible('.files .file .btn-default')
      .wait(1000)
      .then(done.bind(null, null), done);
  },
  'commitnpush': function(commitMessage, done) {
    this.wait('.files .file .btn-default')
      .insert('.staging input.form-control', commitMessage)
      .ug.click('.commit-grp .dropdown-toggle')
      .ug.click('.commitnpush')
      .then(done.bind(null, null), done);
  },
  'amendCommit': function(done) {
    this.ug.click('.amend-link')
      .ug.click('.commit-btn')
      .ug.waitForElementNotVisible('.files .file .btn-default')
      .wait(1000)
      .then(done.bind(null, null), done);
  },
  'emptyCommit': function(done) {
    this.ug.click('.empty-commit-link')
      .ug.click('.commit-btn')
      .ug.waitForElementNotVisible('.files .file .btn-default')
      .wait(1000)
      .then(done.bind(null, null), done);
  },
  'checkout': function(branch, done) {
    this.ug.click(`.branch[data-ta-name="${branch}"]`)
      .ug.click('[data-ta-action="checkout"]:not([style*="display: none"]) .dropmask')
      .wait(`.ref.branch[data-ta-name="${branch}"].current`)
      .then(done.bind(null, null), done);
  },
  'patch': function(commitMessage, done) {
    this.ug.click('.files .file .btn-default')
      .ug.click('.patch')
      .wait('.d2h-diff-tbody input')
      .ug.commit(commitMessage)
      .then(done.bind(null, null), done);
  },
  'backgroundAction': function(method, url, body, done) {
    let req;
    if (method === 'GET') {
      req = request.get(url).withCredentials().query(body);
    } else if (method === 'POST') {
      req = request.post(url).send(body);
    } else if (method === 'DELETE') {
      req = request.delete(url).send(body);
    }

    req.set({'encoding': 'utf8', 'cache-control': 'no-cache', 'Content-Type': 'application/json'});

    req.end((err, res) => {
      let data = (res || {}).body
      try { data = JSON.parse(data); } catch(ex) {}
      done(err, data)
    });
  },
  'createTestFile': function(filename, done) {
    this.ug.backgroundAction('POST', `${rootUrl}/api/testing/createfile`, { file: filename })
      .then(done.bind(null, null), done);
  },
  'shutdownServer': function(done) {
    this.ug.backgroundAction('POST', `${rootUrl}/api/testing/shutdown`, undefined)
      .then(done.bind(null, null), done);
  },

  'changeTestFile': function(filename, done) {
    this.ug.backgroundAction('POST', `${rootUrl}/api/testing/changefile`, { file: filename })
      .then(done.bind(null, null), done);
  },
  'createTempFolder': function(done) {
    winston.info('Creating temp folder');
    this.ug.backgroundAction('POST', `${rootUrl}/api/testing/createtempdir`, undefined)
      .then(done.bind(null, null), done);
  },
  'createFolder': function(dir, done) {
    winston.info(`Create folder: ${dir}`);
    this.ug.backgroundAction('POST', `${rootUrl}/api/createdir`, { dir: dir })
      .then(done.bind(null, null), done);
  },
  'initRepo': function(options, done) {
    (options.path ? rimraf(options.path).then(() => mkdirp(options.path)) : this.ug.createTempFolder())
      .then((res) => {
        options.path = res.path ? res.path : res;
        return this.ug.backgroundAction('POST', `${rootUrl}/api/init`, options)
      }).then(done.bind(null, null), done);
  },
  'gitCommand': function(options, done) {
    this.ug.backgroundAction('POST', `${rootUrl}/api/testing/git`, options)
      .then(done.bind(null, null), done);
  },
  'waitForElementNotVisible': function(selector, done) {
    this.wait((selector) => !document.querySelector(selector), selector)
      .then(done.bind(null, null), done);
  },
  '_verifyRefAction': function(action, done) {
    this.visible('.modal-dialog .btn-primary')
      .then((isVisible) => {
        return (isVisible ? this.ug.click('.modal-dialog .btn-primary') : this)
          .ug.waitForElementNotVisible(`[data-ta-action="${action}"]:not([style*="display: none"])`)
          .wait(200)
      }).then(done.bind(null, null), done);
  },
  'refAction': function(ref, local, action, done) {
    this.ug.click(`.branch[data-ta-name="${ref}"][data-ta-local="${local}"]`)
      .ug.click(`[data-ta-action="${action}"]:not([style*="display: none"]) .dropmask`)
      .then(() => this.ug._verifyRefAction(action))
      .then(done.bind(null, null), done);
  },
  'moveRef': function(ref, targetNodeCommitTitle, done) {
    this.ug.click(`.branch[data-ta-name="${ref}"]`)
      .ug.click(`[data-ta-node-title="${targetNodeCommitTitle}"] [data-ta-action="move"]:not([style*="display: none"]) .dropmask`)
      .then(() => this.ug._verifyRefAction('move'))
      .then(done.bind(null, null), done);
  },
  '_createRef': function(type, name, done) {
    this.ug.click('.current ~ .newRef button.showBranchingForm')
      .insert('.newRef.editing input', name)
      .wait(100)
      // cannot use .ug.click as wait op will defocus and doms will disappear
      .click(`.newRef ${type === 'branch' ? '.btn-primary' : '.btn-default'}`)
      .wait(`.ref.${type}[data-ta-name="${name}"]`)
      .wait(300)
      .then(done.bind(null, null), done);
  },
  'createTag': function(name, done) {
    this.ug._createRef('tag', name).then(done.bind(null, null), done);
  },
  'createBranch': function(name, done) {
    this.ug._createRef('branch', name).then(done.bind(null, null), done);
  },
  'click': function(selector, done) {
    this.wait(selector)
      .wait(300)
      .click(selector)
      .wait(300)
      .mouseover('img.headerLogo')
      .wait(300)
      .then(done.bind(null, null), done);
  },
  'openUngit': function(tempDirPath, done) {
    this.goto(`${rootUrl}/#/repository?path=${encodeURIComponent(tempDirPath)}`)
      .wait('.repository-actions')
      .wait(1000)
      .then(done.bind(null, null), done);
  }
});

const prependLines = (pre, text) => {
  return text.split('\n').filter((l) => l)
    .map((line) => pre + line)
    .join('\n');
}

// Environment provides
class Environment {
  constructor(config) {
    this.nm = Nightmare({ Promise: Bluebird, typeInterval: 500, show: false });
    this.config = config || {};
    this.config.rootPath = (typeof this.config.rootPath === 'string') ? this.config.rootPath : '';
    this.config.serverTimeout = this.config.serverTimeout || 15000;
    this.config.viewWidth = 2000;
    this.config.viewHeight = 2000;
    this.config.showServerOutput = this.config.showServerOutput === undefined ? true : this.config.showServerOutput;
    this.config.serverStartupOptions = this.config.serverStartupOptions || [];
    this.shuttinDown = false;

    // init
    this.nm.viewport(this.config.viewWidth, this.config.viewHeight);
    this.nm.on('console', (type, msg1, msg2) => {
      winston.info(`[ui ${type}] ${(new Date()).toISOString()}  - ${msg1} ${JSON.stringify(msg2)}`);

      if (type === 'error' && !this.shuttinDown) {
        winston.info('ERROR DETECTED!');
      }
    })
  }

  getRootUrl() { return rootUrl; }

  getPort() {
    const tmpPortrange = portrange + Math.floor((Math.random() * 5000));

    return new Bluebird((resolve, reject) => {
      const server = net.createServer();

      server.listen(tmpPortrange, (err) => {
        server.once('close', () => {
          this.port = tmpPortrange;
          rootUrl = `http://localhost:${this.port}${this.config.rootPath}`
          resolve();
        });
        server.close();
      });
      server.on('error', (err) => {
        this.getPort().then(resolve);
      });
    });
  }

  ensureStarted() {
    return Bluebird.resolve()
      .then(() => {
        if (!this.hasStarted) {
          return Bluebird.resolve()
            .delay(50)
            .then(() => this.ensureStarted());
        }
      });
  }

  init() {
    return this.getPort()
      .then(() => this.startServer())
      .then(() => this.ensureStarted())
      .catch((err) => { winston.error(err); throw new Error("Cannot confirm ungit start!!", err); })
  }

  createRepos(testRepoPaths, config) {
    return Bluebird.map(config, (conf) => {
      conf.bare = !!conf.bare;
      return this.nm.ug.initRepo(conf)
        .then(() => this.createCommits(conf, conf.initCommits))
        .then(() => conf.path);
    }).then((paths) => {
      if (testRepoPaths) testRepoPaths.push(...paths)
    });
  }

  shutdown(doNotClose) {
    this.shuttinDown = true;
    return this.nm.ug.backgroundAction('POST', `${rootUrl}/api/testing/cleanup`, undefined)
      .ug.shutdownServer()
      .then(() => {
        if (!doNotClose) {
          return this.nm.end();
        }
      });
  }

  createCommits(config, limit, x) {
    x = x || 0
    if (!limit || limit < 0 || x === limit) return Bluebird.resolve();

    return this.nm.ug.createTestFile(`${config.path}/testy${x}`)
      .then(() => {
        return this.nm.ug.backgroundAction('POST', `${rootUrl}/api/commit`, {
          path: config.path,
          message: `Init Commit ${x}`,
          files: [{ name: `testy${x}` }]
        });
      }).then(() => this.createCommits(config, limit, x + 1))
  }

  goto(url) {
    this.nm = this.nm.goto(url);
    return this.nm;
  }

  startServer() {
    winston.info('Starting ungit server...', this.config.serverStartupOptions);

    this.hasStarted = false;
    const options = ['bin/ungit',
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
      `--numRefsToShow=${this.config.numRefsToShow || 5}`]
      .concat(this.config.serverStartupOptions);
    const ungitServer = child_process.spawn('node', options);
    ungitServer.stdout.on('data', (stdout) => {
      const stdoutStr = stdout.toString();
      if (this.config.showServerOutput) winston.verbose(prependLines('[server] ', stdoutStr));

      if (stdoutStr.indexOf('Ungit server already running') >= 0) {
        winston.info('server-already-running');
      }

      if (stdoutStr.indexOf('## Ungit started ##') >= 0) {
        if (this.hasStarted) {
          winston.info('Ungit started twice, probably crashed.');
        } else {
          this.hasStarted = true;
          winston.info('Ungit server started.');
        }
      }
    });
    ungitServer.stderr.on("data", (stderr) => {
      const stderrStr = stderr.toString();
      winston.error(prependLines('[server ERROR] ', stderrStr));
      if (stderrStr.indexOf("EADDRINUSE") > -1) {
        winston.info("retrying with different port");
        ungitServer.kill('SIGINT');
        this.getPort().then(() => this.startServer());
      }
    });
    ungitServer.on('exit', () => winston.info('UNGIT SERVER EXITED'));
    return Bluebird.resolve();
  }
}
