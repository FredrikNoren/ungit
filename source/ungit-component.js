
var fs = require('fs');
var path = require('path');

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

UngitComponent.prototype.compile = function() {
  var self = this;
  var html = '<!-- Component: ' + this.dir + ' -->\n';
  console.log('Compiling ' + this.dir);

  var exports = this.manifest.exports || {};

  if (exports.raw) {
    var raw = assureArray(exports.raw);
    raw.forEach(function(rawSource) {
      html += fs.readFileSync(path.join(self.path, rawSource)) + '\n';
    });
  }

  if (exports.javascript) {
    var js = assureArray(exports.javascript);
    js.forEach(function(jsSource) {
      html += '<script type="text/javascript">\n' +
        '(function() {' +
        fs.readFileSync(path.join(self.path, jsSource)) + '\n' +
        '})();\n' +
        '</script>\n';
    });
  }

  if (exports.knockoutTemplates) {
    Object.keys(exports.knockoutTemplates).forEach(function(templateName) {
      html += '<script type="text/html" id="' + templateName + '">\n' +
        fs.readFileSync(path.join(self.path, exports.knockoutTemplates[templateName])) +
        '\n</script>\n';
    });
  }

  if (exports.css) {
    var css = assureArray(exports.css);
    css.forEach(function(cssSource) {
      html += '<style>\n' + fs.readFileSync(path.join(self.path, cssSource)) + '\n</style>\n';
    });
  }

  return html;
}