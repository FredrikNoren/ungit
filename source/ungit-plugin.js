
var fs = require('fs');
var path = require('path');
var async = require('async');
var express = require('express');
var winston = require('winston');
var config = require('./config');

function UngitPlugin(args) {
  this.dir = args.dir;
  this.path = args.path;
  this.httpBasePath = args.httpBasePath;
  this.manifest = JSON.parse(fs.readFileSync(path.join(this.path, "ungit-plugin.json")));
  this.name = this.manifest.name || this.dir;
  this.config = config.pluginConfigs[this.name] || {};
}
module.exports = UngitPlugin;

UngitPlugin.prototype.init = function(env) {
  if (this.manifest.server) {
    var serverScript = require(path.join(this.path, this.manifest.server));
    serverScript.install({
        app: env.app,
        httpServer: env.httpServer,
        ensureAuthenticated: env.ensureAuthenticated,
        ensurePathExists: env.ensurePathExists,
        git: require('./git'),
        config: env.config,
        socketIO: env.socketIO,
        socketsById: env.socketsById,
        pluginConfig: this.config,
        httpPath: env.pathPrefix + '/plugins/' + this.name,
        pluginApiVersion: require('../package.json').ungitPluginApiVersion
      });
  }
  env.app.use('/plugins/' + this.name, express.static(this.path));
}

UngitPlugin.prototype.compile = function(callback) {
  var self = this;
  winston.info('Compiling plugin ' + this.path);

  var exports = this.manifest.exports || {};

  var tasks = [];

  if (exports.raw) {
    var raw = assureArray(exports.raw);
    raw.forEach(function(rawSource) {
      tasks.push(function(callback) {
        fs.readFile(path.join(self.path, rawSource), function(err, text) {
          callback(err, text + '\n');
        });
      });
    });
  }

  if (exports.javascript) {
    var js = assureArray(exports.javascript);

    js.forEach(function(filename) {
      tasks.push(function(callback) {
        callback(null, '<script type="text/javascript" src="plugins/' + self.name + '/' + filename +'"></script>');
      });
    });
  }

  if (exports.knockoutTemplates) {
    Object.keys(exports.knockoutTemplates).forEach(function(templateName) {
      tasks.push(function(callback) {
        fs.readFile(path.join(self.path, exports.knockoutTemplates[templateName]), function(err, text) {
          callback(err, '<script type="text/html" id="' + templateName + '">\n' +
            text +
            '\n</script>\n');
        });
      });
    });
  }

  if (exports.css) {
    var css = assureArray(exports.css);
    css.forEach(function(cssSource) {
      tasks.push(function(callback) {
        callback(null, '<link rel="stylesheet" type="text/css" href="/plugins/' + self.name + '/' + cssSource + '" />');
      });
    });
  }

  async.parallel(tasks, function(err, result) {
    if (err) throw err;
    callback(err, '<!-- Component: ' + self.name + ' -->\n' + result.join('\n'))
  });
}

function assureArray(obj) {
  if (obj instanceof Array) return obj;
  else return [obj];
}
