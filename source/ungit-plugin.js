const fsSync = require('fs');
const fs = fsSync.promises;
const path = require('path');
const express = require('express');
const winston = require('winston');
const config = require('./config');

const assureArray = (obj) => {
  return Array.isArray(obj) ? obj : [obj];
};

class UngitPlugin {
  constructor(args) {
    this.dir = args.dir;
    this.path = args.path;
    this.httpBasePath = args.httpBasePath;
    this.manifest = JSON.parse(fsSync.readFileSync(path.join(this.path, 'ungit-plugin.json')));
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
        pluginApiVersion: require('../package.json').ungitPluginApiVersion,
      });
    }
    env.app.use(`/plugins/${this.name}`, express.static(this.path));
  }

  async compile() {
    winston.info(`Compiling plugin ${this.path}`);
    const exports = this.manifest.exports || {};

    let result = '';
    if (exports.raw)
      result += (
        await Promise.all(
          assureArray(exports.raw).map(async (rawSource) => {
            const text = await fs.readFile(path.join(this.path, rawSource));
            return text + '\n';
          })
        )
      ).join('\n');
    if (exports.javascript)
      result += assureArray(exports.javascript)
        .map((filename) => {
          return `<script type="text/javascript" src="${config.rootPath}/plugins/${this.name}/${filename}"></script>`;
        })
        .join('\n');
    if (exports.knockoutTemplates)
      result += (
        await Promise.all(
          Object.keys(exports.knockoutTemplates).map(async (templateName) => {
            const text = await fs.readFile(
              path.join(this.path, exports.knockoutTemplates[templateName])
            );

            return `<script type="text/html" id="${templateName}">\n${text}\n</script>`;
          })
        )
      ).join('\n');
    if (exports.css)
      result += assureArray(exports.css)
        .map((cssSource) => {
          return `<link rel="stylesheet" type="text/css" href="${config.rootPath}/plugins/${this.name}/${cssSource}" />`;
        })
        .join('\n');

    return `<!-- Component: ${this.name} -->\n${result}`;
  }
}
module.exports = UngitPlugin;
