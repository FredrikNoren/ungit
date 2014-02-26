
var fs = require('fs');
var path = require('path');
var less = require('less');
var async = require('async');
var browserify = require('browserify');

function UngitComponent(args) {
  this.dir = args.dir;
  this.path = args.path;
  this.httpBasePath = args.httpBasePath;
  this.manifest = require(path.join(this.path, "ungit-component.json"));
}
module.exports = UngitComponent;

function assureArray(obj) {
  if (obj instanceof Array) return obj;
  else return [obj];
}

UngitComponent.prototype.compile = function(callback) {
  var self = this;
  console.log('Compiling ' + this.path);

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
    b.external('ungit-dialogs');
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
    callback(err, '<!-- Component: ' + self.dir + ' -->\n' + result.join(''))
  });
}