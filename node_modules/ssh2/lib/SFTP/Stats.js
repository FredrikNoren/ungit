var constants = process.binding('constants');

function Stats() {
  this.mode = undefined;
  this.permissions = undefined; // backwards compatiblity
  this.uid = undefined;
  this.gid = undefined;
  this.size = undefined;
  this.atime = undefined;
  this.mtime = undefined;
}

Stats.prototype._checkModeProperty = function(property) {
  return ((this.mode & constants.S_IFMT) === property);
};

Stats.prototype.isDirectory = function() {
  return this._checkModeProperty(constants.S_IFDIR);
};

Stats.prototype.isFile = function() {
  return this._checkModeProperty(constants.S_IFREG);
};

Stats.prototype.isBlockDevice = function() {
  return this._checkModeProperty(constants.S_IFBLK);
};

Stats.prototype.isCharacterDevice = function() {
  return this._checkModeProperty(constants.S_IFCHR);
};

Stats.prototype.isSymbolicLink = function() {
  return this._checkModeProperty(constants.S_IFLNK);
};

Stats.prototype.isFIFO = function() {
  return this._checkModeProperty(constants.S_IFIFO);
};

Stats.prototype.isSocket = function() {
  return this._checkModeProperty(constants.S_IFSOCK);
};

module.exports = Stats;
