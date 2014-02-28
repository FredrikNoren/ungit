
var fs = require('fs');
var path = require('path');
var less = require('less');
var async = require('async');
var browserify = require('browserify');
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

    var b = browserify({
      entries: js.map(function(jsSource) { return path.join(self.path, jsSource); })
    });
    b.external('ungit-components');
    b.external('ungit-program-events');
    b.external('ungit-navigation');
    b.external('ungit-main');
    b.external('ungit-vector2');
    b.external('ungit-address-parser');
    b.external('knockout');
    b.external('lodash');
    b.external('hasher');
    b.external('crossroads');
    b.external('async');
    b.external('moment');
    b.external('blueimp-md5');
    tasks.push(function(callback) {
      b.bundle(null, function(err, text) {
        callback(err, '<script type="text/javascript">\n' +
          '(function() {' +
          text + '\n' +
          '})();\n' +
          '</script>\n');
      });
    })
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
        fs.readFile(path.join(self.path, cssSource), function(err, text) {
          callback(err, '<style>\n' + text + '\n</style>\n');
        });
      });
    });
  }

  if (exports.less) {
    var lessSources = assureArray(exports.less);
    lessSources.forEach(function(lessSource) {
      var parser = new(less.Parser)({ paths: ['.', path.join(__dirname, '..')], filename: lessSource });
      tasks.push(function(callback) {
        fs.readFile(path.join(self.path, lessSource), function(err, text) {
          if (err) return callback(err);
          parser.parse(text.toString(), function (e, tree) {
            callback(e, e ? '' : ('<style>\n' + tree.toCSS({ compress: true }) + '\n</style>\n'));
          });
        });
      });
    });
  }

  async.parallel(tasks, function(err, result) {
    if (err) throw err;
    callback(err, '<!-- Component: ' + self.name + ' -->\n' + result.join(''))
  });
}

function assureArray(obj) {
  if (obj instanceof Array) return obj;
  else return [obj];
}
