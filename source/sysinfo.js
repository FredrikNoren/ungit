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
  return Bluebird.resolve(config.gitVersion);
}
