'use strict';
const child_process = require('child_process');
const Bluebird = require('bluebird');
const Nightmare = require('nightmare');
const net = require('net');
let portrange = 45032;

module.exports = (config) => new Environment(config);

const getRestSetting = (method) => {
  return { method: method, encoding: 'utf8', 'cache-control': 'no-cache', 'Content-Type': 'application/json'};
}

const getUrlArgument = (data) => {
  return Object.keys(data).map((k) => {
      return `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`
    }).join('&')
}

const prependLines = (pre, text) => {
  return text.split('\n').filter((l) => l)
    .map((line) => pre + line)
    .join('\n');
}

// Environment provides
class Environment {
  constructor(config) {
    this.nightmare = Nightmare({ Promise: Bluebird });
    this.config = config || {};
    this.config.rootPath = (typeof this.config.rootPath === 'string') ? this.config.rootPath : '';
    this.config.serverTimeout = this.config.serverTimeout || 15000;
    this.config.viewWidth = 2000;
    this.config.viewHeight = 2000;
    this.config.showServerOutput = this.config.showServerOutput || true;
    this.config.serverStartupOptions = this.config.serverStartupOptions || [];
    this.shuttinDown = false;

    // init
    this.nightmare.viewport(this.config.viewWidth, this.config.viewHeight);
    this.nightmare.on('console', (type, msg) => {
      this.log(`[ui] ${type} - ${msg}`);

      if (type === 'error' && !this.shuttinDown) {
        this.log('ERROR DETECTED!');
        process.exit(1);
      }
    })
  }

  getPort() {
    portrange += 1;

    return new Bluebird((resolve, reject) => {
      const server = net.createServer();

      server.listen(portrange, (err) => {
        server.once('close', () => {
          this.port = portrange;
          this.url = `http://localhost:${this.port}${this.config.rootPath}`
          resolve();
        });
        server.close();
      });
      server.on('error', (err) => {
        this.getPort().then(resolve);
      });
    });
  }

  log(text) {
    console.log((new Date()).toISOString(), text);
  }

  ensureStarted() {
    return Bluebird.resolve()
      .then(() => {
        if (!this.hasStarted) {
          return Bluebird.resolve()
            .delay(50)
            .then(() => { return this.ensureStarted(); });
        }
      });
  }

  init() {
    return this.getPort()
      .then(() => this.startServer())
      .then(() => this.ensureStarted())
      .timeout(7000)
      .catch((err) => { throw new Error("Cannot confirm ungit start!!"); })
      .then(() => this.createTempFolder())
      .then((res) => this.path = res.path);
  }

  createRepos(config) {
    return Bluebird.map(config, (conf) => {
      return this.createFolder(conf.path)
        .then(() => this.initFolder({ bare: !!conf.bare, path: conf.path }))
        .then(() => this.createCommits(conf, conf.initCommits));
    });
  }

  shutdown(doNotClose) {
    this.shuttinDown = true;
    return this.backgroundAction('POST', `${this.url}/api/testing/cleanup`)
      .then(() => this.shutdownServer())
      .then(() => { if (!doNotClose) this.nightmare.end(); });
  }

  createCommits(config, limit, x) {
    x = x || 0
    if (!limit || limit < 0 || x === limit) return Bluebird.resolve();

    return this.createTestFile(`${config.path}/testy${x}`)
      .then(() => {
        return this.backgroundAction('POST', `${this.url}/api/commit`, {
          path: config.path,
          message: `Init Commit ${x}`,
          files: [{ name: `testy${x}` }]
        });
      }).then(() => this.createCommits(config, limit, x + 1))
  }

  goto(url) {
    this.nightmare = this.nightmare.goto(url);
    return this.nightmare;
  }

  startServer() {
    this.log('Starting ungit server...', this.config.serverStartupOptions);

    this.hasStarted = false;
    const options = ['bin/ungit',
      '--cliconfigonly',
      `--port=${this.port}`,
      `--rootPath=${this.config.rootPath}`,
      '--no-launchBrowser',
      '--dev',
      '--no-bugtracking',
      '--no-sendUsageStatistics',
      `--autoShutdownTimeout=${this.config.serverTimeout}`,
      '--logLevel=debug',
      '--maxNAutoRestartOnCrash=0',
      '--no-autoCheckoutOnBranchCreate',
      '--alwaysLoadActiveBranch',
      '--logGitCommands']
      .concat(this.config.serverStartupOptions);
    const ungitServer = child_process.spawn('node', options);
    ungitServer.stdout.on('data', (data) => {
      if (this.config.showServerOutput) this.log(prependLines('[server] ', data.toString()));

      if (data.toString().indexOf('Ungit server already running') >= 0) {
        this.log('server-already-running');
      }

      if (data.toString().indexOf('## Ungit started ##') >= 0) {
        if (this.hasStarted) {
          this.log('Ungit started twice, probably crashed.');
        } else {
          this.hasStarted = true;
          this.log('Ungit server started.');
        }
      }
    });
    ungitServer.stderr.on("data", (data) => {
      this.log(prependLines('[server ERROR] ', data.toString()));
      if (data.indexOf("EADDRINUSE") > -1) {
        this.log("retrying with different port");
        ungitServer.kill('SIGINT');
        this.getPort().then(() => this.startServer());
      }
    });
    ungitServer.on('exit', () => this.log('UNGIT SERVER EXITED'));
    return Bluebird.resolve();
  }

  backgroundAction(method, url, body) {
    if (method === 'GET') {
      url += getUrlArgument(body);
      body = null;
    } else {
      body = JSON.stringify(body);
    }
    console.log("^^^^")
    return this.nightmare.goto(url, getRestSetting(method), body)
      .evaluate(() => {
        console.log("****")
        return document.querySelector('pre').innerHTML
      })
      .then((data) => {
        console.log("!!!!!")
        try { data = JSON.parse(data); } catch(ex) {}
        return data;
      });
  }

  createTestFile(filename) {
    return this.backgroundAction('POST', `${this.url}/api/testing/createfile`, { file: filename });
  }
  changeTestFile(filename) {
    return this.backgroundAction('POST', `${this.url}/api/testing/changefile`, { file: filename });
  }
  shutdownServer() {
    return this.backgroundAction('POST', `${this.url}/api/testing/shutdown`);
  }
  createTempFolder() {
    this.log('Creating temp folder');
    return this.backgroundAction('POST', `${this.url}/api/testing/createtempdir`);
  }
  createFolder(dir) {
    this.log(`Create folder: ${dir}`);
    return this.backgroundAction('POST', `${this.url}/api/createdir`, { dir: dir });
  }
  initFolder(options) {
    return this.backgroundAction('POST', `${this.url}/api/init`, options);
  }
  gitCommand(options) {
    return this.backgroundAction('POST', `${this.url}/api/testing/git`, options);
  }
}
