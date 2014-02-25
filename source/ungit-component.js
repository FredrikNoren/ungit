
var fs = require('fs');
var path = require('path');
var less = require('less');
var async = require('async');

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
  console.log('Compiling ' + this.dir);

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
    js.forEach(function(jsSource) {
      tasks.push(function(callback) {
        fs.readFile(path.join(self.path, jsSource), function(err, text) {
          callback(err, '<script type="text/javascript">\n' +
            '(function() {' +
            text + '\n' +
            '})();\n' +
            '</script>\n');
        });
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
        fs.readFile(path.join(self.path, cssSource), function(err, text) {
          callback(err, '<style>\n' + text + '\n</style>\n');
        });
      });
    });
  }

  if (exports.less) {
    var lessSources = assureArray(exports.less);
    lessSources.forEach(function(lessSource) {
      var parser = new(less.Parser)({ filename: lessSource });
      tasks.push(function(callback) {
        fs.readFile(path.join(self.path, lessSource), function(err, text) {
          if (err) return callback(err);
          parser.parse(text.toString(), function (e, tree) {
            callback(e, '<style>\n' + tree.toCSS({ compress: true }) + '\n</style>\n');
          });
        });
      });
    });
  }

  async.parallel(tasks, function(err, result) {
    callback(err, '<!-- Component: ' + this.dir + ' -->\n' + result.join(''))
  });
}