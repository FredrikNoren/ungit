const fs = require('fs');
const child_process = require('child_process');
const path = require('path');
const getmac = require('getmac');
const md5 = require('blueimp-md5');
const semver = require('semver');
const npm = require('npm');
const RegClient = require('npm-registry-client');
const config = require('./config');

const noop = () => {}

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
  const result = {
    requiredVersion: '>=1.8.x',
    version: 'unkown',
    satisfied: false
  };

  if (!config.gitVersion) {
    result.error = `Failed to parse git version number. Note that Ungit requires git version ${result.requiredVersion}`;
  } else {
    result.version = config.gitVersion;
    result.satisfied = semver.satisfies(result.version, result.requiredVersion);
    if (!result.satisfied) {
      result.error = `Ungit requires git version ${result.requiredVersion}, you are currently running ${result.version}`;
    }
  }

  callback(result);
}
