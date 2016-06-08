const fs = require('fs');
const child_process = require('child_process');
const path = require('path');
const cache = require('./utils/cache');
const getmac = require('getmac');
const md5 = require('blueimp-md5');
const semver = require('semver');
const npm = require('npm');
const RegClient = require('npm-registry-client');
const version = require('../package.json').version

const noop = () => {}

exports.getUngitVersion = cache((callback) => {
  exports.getUngitPackageJsonVersion((err, packageJsonVersion) => {
    if (err) return callback(err);
    if (fs.existsSync(path.join(__dirname, '..', '.git'))){
      child_process.exec('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') }, (err, revision) => {
        revision.replace('\n', ' ');
        revision = revision.trim();

        callback(null, `dev-${packageJsonVersion}-${revision}`);
      });
    } else {
      callback(null, packageJsonVersion);
    }
  });
});

exports.getUngitPackageJsonVersion = (callback) => {
  callback(null, version);
};

exports.getUngitLatestVersion = (callback) => {
  npm.load({}, (err, config) => {
    if (err) return callback(err);
    config.log = { error: noop, warn: noop, info: noop,
             verbose: noop, silly: noop, http: noop,
             pause: noop, resume: noop };
    const client = new RegClient(config);

    client.get('https://registry.npmjs.org/ungit', { timeout: 1000 }, (err, data, raw, res) => {
      if (err) return callback(err);
      const versions = Object.keys(data.versions);
      callback(null, versions[versions.length - 1]);
    })
  });
}

exports.getUserHash = (callback) => {
  getmac.getMac((err, addr) => {
    callback(err, md5(addr));
  });
}

exports.getGitVersionInfo = (callback) => {
  child_process.exec('git --version', (err, stdout, stderr) => {
    const result = {
      requiredVersion: '>=1.8.x',
      version: 'unkown',
      satisfied: false
    };

    if (err) {
      result.error = 'Can\'t run "git --version". Is git installed and available in your path?';
    } else {
      const versionSearch = /.*?(\d+[.]\d+[.]\d+).*/.exec(stdout);
      if (!versionSearch) {
        result.error = `Failed to parse git version number: ${stdout}. Note that Ungit requires git version ${result.requiredVersion}`;
      } else {
        result.version = versionSearch[1];
        result.satisfied = semver.satisfies(result.version, result.requiredVersion);
        if (!result.satisfied) {
          result.error =
            `Ungit requires git version ${result.requiredVersion}, you are currently running ${result.version}`;
        }
      }
    }

    callback(result);
  });
}
