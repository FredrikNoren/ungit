
const fs = require('fs');
const path = require('path');
const express = require('express');
const winston = require('winston');
const config = require('./config');
const Bluebird = require('bluebird');

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

  compile() {
    winston.info(`Compiling plugin ${this.path}`);
    const exports = this.manifest.exports || {};

    return Bluebird.resolve().then(() => {
      if (exports.raw) {
        return Bluebird.all(assureArray(exports.raw).map((rawSource) => {
          return fs.readFileAsync(path.join(this.path, rawSource)).then((text) => {
            return text + '\n';
          });
        })).then((result) => {
          return result.join('\n');
        });
      } else {
        return '';
      }
    }).then((result) => {
      if (exports.javascript) {
        return result + assureArray(exports.javascript).map(filename => {
          return `<script type="text/javascript" src="${config.rootPath}/plugins/${this.name}/${filename}"></script>`;
        }).join('\n');
      } else {
        return result;
      }
    }).then((result) => {
      if (exports.knockoutTemplates) {
        return Bluebird.all(Object.keys(exports.knockoutTemplates).map((templateName) => {
          return fs.readFileAsync(path.join(this.path, exports.knockoutTemplates[templateName])).then((text) => {
            return `<script type="text/html" id="${templateName}">\n${text}\n</script>`;
          });
        })).then((templates) => {
          return result + templates.join('\n');
        });
      } else {
        return result;
      }
    }).then((result) => {
      if (exports.css) {
        return result + assureArray(exports.css).map((cssSource) => {
          return `<link rel="stylesheet" type="text/css" href="${config.rootPath}/plugins/${this.name}/${cssSource}" />`;
        }).join('\n');
      } else {
        return result;
      }
    }).then((result) => {
      return `<!-- Component: ${this.name} -->\n${result}`;
    });
  }
}
module.exports = UngitPlugin;
