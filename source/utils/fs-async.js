var Promise = require('bluebird');
var fs = Promise.promisifyAll(require("fs"));
fs.isFileExists = function(file) {
  return fs.accessAsync(file, fs.F_OK)
    .then(function() { return true; })
    .catch(function() { return false; });
}

module.exports = fs;
