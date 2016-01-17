'use strict';

const Bluebird = require('bluebird');
const fs = Bluebird.promisifyAll(require("fs"));
const semver = require('semver');

if (semver.satisfies(process.version, '>0.10')) {
  fs.isExists = (file) => {
    return fs.accessAsync(file, fs.F_OK)
      .then(() => true)
      .catch(() => false);
  }
} else {
  fs.isExists = (file) => new Bluebird((resolve) => fs.exists(file, resolve))
}

module.exports = fs;
