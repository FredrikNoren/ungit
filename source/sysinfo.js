const getmac = require('getmac');
const md5 = require('blueimp-md5');
const semver = require('semver');
const npm = require('npm');
const RegClient = require('npm-registry-client');
const config = require('./config');
const Bluebird = require('bluebird');
const winston = require('winston');

const noop = () => {}

exports.getUngitLatestVersion = () => {
  return new Bluebird((resolve, reject) => {
    npm.load({}, (err, config) => {
      if (err) return reject(err);
      config.log = { error: noop, warn: noop, info: noop,
               verbose: noop, silly: noop, http: noop,
               pause: noop, resume: noop };
      resolve(new RegClient(config));
    });
  }).then((client) => {
    return new Bluebird((resolve, reject) => {
      client.get('https://registry.npmjs.org/ungit', { timeout: 1000 }, (err, data, raw, res) => {
        if (err) {
          reject(err);
        } else {
          const versions = Object.keys(data.versions);
          resolve(versions[versions.length - 1]);
        }
      });
    });
  });
}

exports.getUserHash = () => {
  return new Bluebird((resolve) => {
    getmac.getMac((err, addr) => {
      if (err) {
        winston.error("attempt to get mac addr failed, using fake mac.", err);
        addr = "abcde";
      }
      resolve(md5(addr));
    });
  });
}

exports.getGitVersionInfo = () => {
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

  return Bluebird.resolve(result);
}
