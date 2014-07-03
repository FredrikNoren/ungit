var fs = require('fs');
var child_process = require('child_process');
var path = require('path');
var cache = require('./utils/cache');
var getmac = require('getmac');
var md5 = require('blueimp-md5').md5;

var sysinfo = exports;

sysinfo.getUngitVersion = cache(function(callback) {
  sysinfo.getUngitPackageJsonVersion(function(err, packageJsonVersion) {
    if (err) return callback(err);
    if (fs.existsSync(path.join(__dirname, '..', '.git'))){
      child_process.exec('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') }, function(err, revision) {
        revision.replace('\n', ' ');
        revision = revision.trim();

        var ver = 'dev-' + packageJsonVersion + '-' + revision;
        callback(null, ver);
      });
    } else {
      callback(null, packageJsonVersion);
    }
  });
});

sysinfo.getUngitPackageJsonVersion = function(callback) {
  callback(null, require('../package.json').version);
};

function noop() {}

var npmconf, RegClient;
sysinfo.getUngitLatestVersion = function(callback) {
  if (!npmconf) npmconf = require('npmconf');
  if (!RegClient) RegClient = require('npm-registry-client');
  npmconf.load({}, function(err, config) {
    if (err) return callback(err);
    config.log = { error: noop, warn: noop, info: noop,
             verbose: noop, silly: noop, http: noop,
             pause: noop, resume: noop };
    var client = new RegClient(config);

    client.get('https://registry.npmjs.org/ungit', { timeout: 1000 }, function (err, data, raw, res) {
      if (err) return callback(err);
      var versions = Object.keys(data.versions);
      callback(null, versions[versions.length - 1]);
    })
  });
}

sysinfo.getUserHash = function(callback) {
  getmac.getMac(function(err, addr) {
    callback(err, md5(addr));
  });
}