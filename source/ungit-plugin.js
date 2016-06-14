
const fs = require('fs');
const path = require('path');
const async = require('async');
const express = require('express');
const winston = require('winston');
const config = require('./config');

const assureArray = (obj) => { return Array.isArray(obj) ? obj : [obj]; }

class UngitPlugin {
  constructor(args) {
    this.dir = args.dir;
    this.path = args.path;
    this.httpBasePath = args.httpBasePath;
    this.manifest = JSON.parse(fs.readFileSync(path.join(this.path, "ungit-plugin.json")));
    this.name = this.manifest.name || this.dir;
    this.config = config.pluginConfigs[this.name] || {};
  }

  init(env) {
    if (this.manifest.server) {
      const serverScript = require(path.join(this.path, this.manifest.server));
      serverScript.install({
          app: env.app,
          httpServer: env.httpServer,
          ensureAuthenticated: env.ensureAuthenticated,
          ensurePathExists: env.ensurePathExists,
          git: require('./git-promise'),
          config: env.config,
          socketIO: env.socketIO,
          socketsById: env.socketsById,
          pluginConfig: this.config,
          httpPath: `${env.pathPrefix}/plugins/${this.name}`,
          pluginApiVersion: require('../package.json').ungitPluginApiVersion
        });
    }
    env.app.use(`/plugins/${this.name}`, express.static(this.path));
  }

  compile(callback) {
    winston.info(`Compiling plugin ${this.path}`);
    const exports = this.manifest.exports || {};
    const tasks = [];

    if (exports.raw) {
      const raw = assureArray(exports.raw);
      raw.forEach((rawSource) => {
        tasks.push((callback) => {
          fs.readFile(path.join(this.path, rawSource), (err, text) => {
            callback(err, text + '\n');
          });
        });
      });
    }

    if (exports.javascript) {
      const js = assureArray(exports.javascript);

      js.forEach((filename) => {
        tasks.push((callback) => {
          callback(null, `<script type="text/javascript" src="${config.rootPath}/plugins/${this.name}/${filename}"></script>`);
        });
      });
    }

    if (exports.knockoutTemplates) {
      Object.keys(exports.knockoutTemplates).forEach((templateName) => {
        tasks.push((callback) => {
          fs.readFile(path.join(this.path, exports.knockoutTemplates[templateName]), (err, text) => {
            callback(err, `<script type="text/html" id="${templateName}">\n${text}\n</script>\n`);
          });
        });
      });
    }

    if (exports.css) {
      const css = assureArray(exports.css);
      css.forEach((cssSource) => {
        tasks.push((callback) => {
          callback(null, `<link rel="stylesheet" type="text/css" href="${config.rootPath}/plugins/${this.name}/${cssSource}" />`);
        });
      });
    }

    async.parallel(tasks, (err, result) => {
      if (err) throw err;
      callback(err, `<!-- Component: ${this.name} -->\n${result.join('\n')}`)
    });
  }
}
module.exports = UngitPlugin;
