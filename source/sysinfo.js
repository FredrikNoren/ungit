const getMac = require('getmac').default;
const md5 = require('blueimp-md5');
const semver = require('semver');
const logger = require('./utils/logger');
const config = require('./config');

exports.getUngitLatestVersion = () => {
  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  return import('latest-version').then((latestVersion) => {
    return latestVersion.default('ungit');
  });
};

exports.getUserHash = () => {
  let addr;
  try {
    addr = getMac();
  } catch (err) {
    logger.error('attempt to get mac addr failed, using fake mac.', err);
    addr = 'abcde';
  }
  return md5(addr);
};

exports.getGitVersionInfo = () => {
  const result = {
    requiredVersion: '>=1.8.x',
    version: 'unkown',
    satisfied: false,
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

  return result;
};
