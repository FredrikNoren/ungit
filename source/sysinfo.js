const Bluebird = require('bluebird');
const getmac = require('getmac');
const latestVersion = require('latest-version');
const md5 = require('blueimp-md5');
const semver = require('semver');
const winston = require('winston');
const config = require('./config');


exports.getUngitLatestVersion = () => {
  return latestVersion('ungit');
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
