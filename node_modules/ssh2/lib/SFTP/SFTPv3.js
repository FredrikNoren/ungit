var EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits,
    isDate = require('util').isDate,
    fs = require('fs'),
    Stream = require('stream'),
    Stats = require('./Stats');

var MAX_REQID = Math.pow(2, 32) - 1,
    VERSION_BUFFER = new Buffer([0, 0, 0, 5 /* length */,
                                 1 /* REQUEST.INIT */,
                                 0, 0, 0, 3 /* version */]),
    EMPTY_CALLBACK = function() {};

module.exports = SFTP;

function SFTP(stream) {
  var self = this;

  this._stream = stream;
  this._requests = {};
  this._reqid = 0;
  this._reqidmaxed = false;

  this._count = 0;
  this._value = 0;
  this._string = undefined;
  this._field = 'packet_length';
  this._data = {
    len: 0,
    type: undefined,
    subtype: undefined,
    reqid: undefined,
    version: undefined,
    statusCode: undefined,
    errMsg: undefined,
    lang: undefined,
    handle: undefined,
    data: undefined,
    count: undefined,
    names: undefined,
    c: undefined,
    attrs: undefined,
    _attrs: undefined,
    _flags: undefined
  };

  stream.on('data', function(data, type) {
    if (!type)
      self._parse(data);
  });
  stream.once('error', function(err) {
    self.emit('error', err);
  });
  stream.once('end', function() {
    self.emit('end');
  });
  stream.once('close', function(had_err) {
    self.emit('close', had_err);
  });
}
inherits(SFTP, EventEmitter);

SFTP.prototype.end = function() {
  this._stream.end();
};

SFTP.prototype.createReadStream = function(path, options) {
  return new ReadStream(this, path, options);
};

SFTP.prototype.createWriteStream = function(path, options) {
  return new WriteStream(this, path, options);
};

SFTP.prototype.open = function(filename, mode, attrs, cb) {
  if (typeof attrs === 'function') {
    cb = attrs;
    attrs = undefined;
  }

  if (mode === 'r')
    mode = OPEN_MODE.READ;
  else if (mode === 'r+')
    mode = OPEN_MODE.READ | OPEN_MODE.WRITE;
  else if (mode === 'w')
    mode = OPEN_MODE.TRUNC | OPEN_MODE.CREAT | OPEN_MODE.WRITE;
  else if (mode === 'wx' || mode === 'xw')
    mode = OPEN_MODE.TRUNC | OPEN_MODE.CREAT | OPEN_MODE.WRITE | OPEN_MODE.EXCL;
  else if (mode === 'w+')
    mode = OPEN_MODE.TRUNC | OPEN_MODE.CREAT | OPEN_MODE.READ | OPEN_MODE.WRITE;
  else if (mode === 'wx+' || mode === 'xw+') {
    mode = OPEN_MODE.TRUNC | OPEN_MODE.CREAT | OPEN_MODE.READ | OPEN_MODE.WRITE
           | OPEN_MODE.EXCL;
  } else if (mode === 'a')
    mode = OPEN_MODE.APPEND | OPEN_MODE.CREAT | OPEN_MODE.WRITE;
  else if (mode === 'ax' || mode === 'xa')
    mode = OPEN_MODE.APPEND | OPEN_MODE.CREAT | OPEN_MODE.WRITE | OPEN_MODE.EXCL;
  else if (mode === 'a+')
    mode = OPEN_MODE.APPEND | OPEN_MODE.CREAT | OPEN_MODE.READ | OPEN_MODE.WRITE;
  else if (mode === 'ax+' || mode === 'xa+') {
    mode = OPEN_MODE.APPEND | OPEN_MODE.CREAT | OPEN_MODE.READ | OPEN_MODE.WRITE
           | OPEN_MODE.EXCL;
  } else
    throw new Error('Invalid mode');

  var flags = 0, attrBytes = 0;
  if (typeof attrs === 'object') {
    attrs = attrsToBytes(attrs);
    flags = attrs[0];
    attrBytes = attrs[1];
    attrs = attrs[2];
  }

  /*
    uint32        id
    string        filename
    uint32        pflags
    ATTRS         attrs
  */
  var fnamelen = Buffer.byteLength(filename),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + fnamelen + 4 + 4 + attrBytes);
  buf[4] = REQUEST.OPEN;
  buf.writeUInt32BE(fnamelen, p, true);
  buf.write(filename, p += 4, fnamelen, 'utf8');
  buf.writeUInt32BE(mode, p += fnamelen, true);
  buf.writeUInt32BE(flags, p += 4, true);
  if (flags && attrs) {
    p += 4;
    for (var i = 0, len = attrs.length; i < len; ++i)
      for (var j = 0, len2 = attrs[i].length; j < len2; ++j)
        buf[p++] = attrs[i][j];
  }

  return this._send(buf, cb);
};

SFTP.prototype.close = function(handle, cb) {
  if (!Buffer.isBuffer(handle))
    throw new Error('handle is not a Buffer');
  /*
    uint32     id
    string     handle
  */
  var handlelen = handle.length,
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + handlelen);
  buf[4] = REQUEST.CLOSE;
  buf.writeUInt32BE(handlelen, p, true);
  handle.copy(buf, p += 4);

  return this._send(buf, cb);
};

SFTP.prototype.read = function(handle, buffer, offset, length, position, cb) {
  // TODO: emulate support for position === null to match fs.read()
  if (!Buffer.isBuffer(handle))
    throw new Error('handle is not a Buffer');

  if (!Buffer.isBuffer(buffer))
    throw new Error('buffer is not a Buffer');
  else if (offset >= buffer.length)
    throw new Error('offset is out of bounds');
  else if (offset + length > buffer.length)
    throw new Error('length extends beyond buffer');

  if (position === null)
    throw new Error('null position currently unsupported');
  /*
    uint32     id
    string     handle
    uint64     offset
    uint32     len
  */
  var handlelen = handle.length,
      p = 9,
      pos = position,
      buf = new Buffer(4 + 1 + 4 + 4 + handlelen + 8 + 4);
  buf[4] = REQUEST.READ;
  buf.writeUInt32BE(handlelen, p, true);
  handle.copy(buf, p += 4);
  p += handlelen;
  for (var i = 7; i >= 0; --i) {
    buf[p + i] = pos & 0xFF;
    pos /= 256;
  }
  buf.writeUInt32BE(length, p += 8, true);

  return this._send(buf, function(err, bytesRead, data) {
    if (err)
      return cb(err);
    cb(undefined, bytesRead || 0, data, position);
  }, buffer.slice(offset, offset + length));
};

SFTP.prototype.write = function(handle, buffer, offset, length, position, cb) {
  // TODO: emulate support for position === null to match fs.write()
  if (!Buffer.isBuffer(handle))
    throw new Error('handle is not a Buffer');
  else if (!Buffer.isBuffer(buffer))
    throw new Error('buffer is not a Buffer');
  else if (offset > buffer.length)
    throw new Error('offset is out of bounds');
  else if (offset + length > buffer.length)
    throw new Error('length extends beyond buffer');
  else if (position === null)
    throw new Error('null position currently unsupported');

  if (!length) {
    cb && process.nextTick(function() { cb(undefined, 0); });
    return;
  }

  /*
    uint32     id
    string     handle
    uint64     offset
    string     data
  */
  var handlelen = handle.length,
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + handlelen + 8 + 4 + length);
  buf[4] = REQUEST.WRITE;
  buf.writeUInt32BE(handlelen, p, true);
  handle.copy(buf, p += 4);
  p += handlelen;
  for (var i = 7; i >= 0; --i) {
    buf[p + i] = position & 0xFF;
    position /= 256;
  }
  buf.writeUInt32BE(length, p += 8, true);
  buffer.copy(buf, p += 4, offset, offset + length);

  return this._send(buf, function(err) {
    if (err)
      cb && cb(err);
    else
      cb && cb(undefined, length);
  });
};

function fastXfer(src, dst, srcPath, dstPath, opts, cb) {
  var concurrency = 25, chunkSize = 32768;

  if (typeof opts === 'function')
    cb = opts;
  else if (typeof opts === 'object') {
    if (typeof opts.concurrency === 'number' && opts.concurrency > 0
        && !isNaN(opts.concurrency))
      concurrency = opts.concurrency;
    if (typeof opts.chunkSize === 'number' && opts.chunkSize > 0
        && !isNaN(opts.chunkSize))
      chunkSize = opts.chunkSize;
  }

  // internal state variables
  var fsize, chunk, psrc = 0, pdst = 0, reads = 0, total = 0, srcfd, dstfd,
      readbuf = new Buffer(chunkSize * concurrency);

  function onerror(err) {
    var left = 0, cbfinal;

    if (srcfd || dstfd) {
      cbfinal = function() {
        if (--left === 0)
          cb(err);
      };
    } else
      cb(err);
    if (srcfd) {
      ++left;
      fs.close(srcfd, cbfinal);
    }
    if (dstfd) {
      ++left;
      src.close(dstfd, cbfinal);
    }
  }

  src.stat(srcPath, function(err, attrs) {
    if (err) return onerror(err);
    fsize = attrs.size;

    src.open(srcPath, 'r', function(err, sourcefd) {
      if (err) return onerror(err);
      srcfd = sourcefd;

      dst.open(dstPath, 'w', function(err, destfd) {
        if (err) return onerror(err);
        dstfd = destfd;

        if (fsize <= 0) return cb();
        function onread(err, nb, data, dstpos, datapos) {
          if (err) return onerror(err);

          dst.write(destfd, data, datapos || 0, nb, dstpos, function(err) {
            if (err) return onerror(err);

            if (--reads === 0) {
              if (total === fsize) {
                dst.close(destfd, function(err) {
                  dstfd = undefined;
                  if (err) return onerror(err);
                  src.close(sourcefd, function(err) {
                    srcfd = undefined;
                    if (err) return onerror(err);
                    cb();
                  });
                });
              } else
                read();
            }
          });
          total += nb;
        }

        function makeCb(psrc, pdst) {
          return function(err, nb, data) {
            onread(err, nb, data, pdst, psrc);
          };
        }

        function read() {
          while (pdst < fsize && reads < concurrency) {
            chunk = (pdst + chunkSize > fsize ? fsize - pdst : chunkSize);
            if (src === fs)
              src.read(sourcefd, readbuf, psrc, chunk, pdst, makeCb(psrc, pdst));
            else
              src.read(sourcefd, readbuf, psrc, chunk, pdst, onread);
            psrc += chunk;
            pdst += chunk;
            ++reads;
          }
          psrc = 0;
        }
        read();
      });
    });
  });
}

SFTP.prototype.fastGet = function(remotePath, localPath, opts, cb) {
  fastXfer(this, fs, remotePath, localPath, opts, cb);
};

SFTP.prototype.fastPut = function(localPath, remotePath, opts, cb) {
  fastXfer(fs, this, localPath, remotePath, opts, cb);
};

SFTP.prototype.readFile = function(path, encoding, cb) {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = undefined;
  }

  var self = this;

  // first, stat the file, so we know the size.
  var size;
  var buffer; // single buffer with file data
  var buffers; // list for when size is unknown
  var pos = 0;
  var bytesRead = 0;
  var handle;

  this.open(path, 'r', 438 /*=0666*/, function(err, handle_) {
    if (err)
      return cb(err);
    handle = handle_;

    self.fstat(handle, function(err, st) {
      if (err)
        return cb(err);
      size = st.size;
      if (size === 0) {
        // the kernel lies about many files.
        // Go ahead and try to read some bytes.
        buffers = [];
        return read();
      }

      buffer = new Buffer(size);
      read();
    });
  });

  function read() {
    if (size === 0) {
      buffer = new Buffer(8192);
      self.read(handle, buffer, 0, 8192, bytesRead, afterRead);
    } else {
      self.read(handle, buffer, pos, size - pos, bytesRead, afterRead);
    }
  }

  function afterRead(err, nbytes) {
    if (err) {
      return self.close(handle, function() {
        return cb(err);
      });
    }

    if (nbytes === 0)
      return close();

    bytesRead += nbytes;
    pos += nbytes;
    if (size !== 0) {
      if (pos === size)
        close();
      else
        read();
    } else {
      // unknown size, just read until we don't get bytes.
      buffers.push(buffer.slice(0, nbytes));
      read();
    }
  }

  function close() {
    self.close(handle, function(err) {
      if (size === 0) {
        // collected the data into the buffers list.
        buffer = Buffer.concat(buffers, pos);
      } else if (pos < size)
        buffer = buffer.slice(0, pos);

      if (encoding)
        buffer = buffer.toString(encoding);
      return cb(err, buffer);
    });
  }
};

SFTP.prototype.writeFile = function(path, data, encoding, cb) {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = 'utf8';
  }

  var self = this;

  this.open(path, 'w', 438 /*=0666*/, function(err, handle) {
    if (err)
      cb && cb(err);
    else {
      var buf = Buffer.isBuffer(data)
                ? data
                : new Buffer('' + data, encoding);
      self._writeAll(handle, buf, 0, buf.length, 0, cb);
    }
  });
};

SFTP.prototype.appendFile = function(path, data, encoding, cb) {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = 'utf8';
  }

  var self = this;

  this.open(path, 'a', 438 /*=0666*/, function(err, handle) {
    if (err)
      cb && cb(err);
    else {
      var buf = Buffer.isBuffer(data)
                ? data
                : new Buffer('' + data, encoding);
      // Yeah, so basically append mode is equivalent to write mode since
      // SFTPv3 requires an absolute offset in all cases ....
      self.fstat(handle, function(err2, attrs) {
        if (err2)
          cb && cb(err2);
        else {
          self._writeAll(handle, buf, 0, buf.length, attrs.size, cb);
        }
      });
    }
  });
};

SFTP.prototype.exists = function(path, cb) {
  this.stat(path, function(err) {
    cb && cb(err ? false : true);
  });
};

SFTP.prototype.unlink = function(filename, cb) {
  /*
    uint32     id
    string     filename
  */
  var fnamelen = Buffer.byteLength(filename),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + fnamelen);
  buf[4] = REQUEST.REMOVE;
  buf.writeUInt32BE(fnamelen, p, true);
  buf.write(filename, p += 4, fnamelen, 'utf8');

  return this._send(buf, cb);
};

SFTP.prototype.rename = function(oldPath, newPath, cb) {
  /*
    uint32     id
    string     oldpath
    string     newpath
  */
  var oldlen = Buffer.byteLength(oldPath),
      newlen = Buffer.byteLength(newPath),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + oldlen + 4 + newlen);
  buf[4] = REQUEST.RENAME;
  buf.writeUInt32BE(oldlen, p, true);
  buf.write(oldPath, p += 4, oldlen, 'utf8');
  buf.writeUInt32BE(newlen, p += oldlen, true);
  buf.write(newPath, p += 4, newlen, 'utf8');

  return this._send(buf, cb);
};

SFTP.prototype.mkdir = function(path, attrs, cb) {
  var flags = 0, attrBytes = 0;
  if (typeof attrs === 'function') {
    cb = attrs;
    attrs = undefined;
  }
  if (typeof attrs === 'object') {
    attrs = attrsToBytes(attrs);
    flags = attrs[0];
    attrBytes = attrs[1];
    attrs = attrs[2];
  }
  /*
    uint32     id
    string     path
    ATTRS      attrs
  */
  var pathlen = Buffer.byteLength(path),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + pathlen + 4 + attrBytes);
  buf[4] = REQUEST.MKDIR;
  buf.writeUInt32BE(pathlen, p, true);
  buf.write(path, p += 4, pathlen, 'utf8');
  buf.writeUInt32BE(flags, p += pathlen);
  if (flags) {
    p += 4;
    for (var i = 0, len = attrs.length; i < len; ++i)
      for (var j = 0, len2 = attrs[i].length; j < len2; ++j)
        buf[p++] = attrs[i][j];
  }

  return this._send(buf, cb);
};

SFTP.prototype.rmdir = function(path, cb) {
  /*
    uint32     id
    string     path
  */
  var pathlen = Buffer.byteLength(path),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + pathlen);
  buf[4] = REQUEST.RMDIR;
  buf.writeUInt32BE(pathlen, p, true);
  buf.write(path, p += 4, pathlen, 'utf8');

  return this._send(buf, cb);
};

SFTP.prototype.readdir = function(handle, cb) {
  if (!Buffer.isBuffer(handle))
    throw new Error('handle is not a Buffer');
  /*
    uint32     id
    string     handle
  */
  var handlelen = handle.length,
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + handlelen);
  buf[4] = REQUEST.READDIR;
  buf.writeUInt32BE(handlelen, p, true);
  handle.copy(buf, p += 4);

  return this._send(buf, cb);
};

SFTP.prototype.fstat = function(handle, cb) {
  if (!Buffer.isBuffer(handle))
    throw new Error('handle is not a Buffer');
  /*
    uint32     id
    string     handle
  */
  var handlelen = handle.length,
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + handlelen);
  buf[4] = REQUEST.FSTAT;
  buf.writeUInt32BE(handlelen, p, true);
  handle.copy(buf, p += 4);

  return this._send(buf, cb);
};

SFTP.prototype.stat = function(path, cb) {
  /*
    uint32     id
    string     path
  */
  var pathlen = Buffer.byteLength(path),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + pathlen);
  buf[4] = REQUEST.STAT;
  buf.writeUInt32BE(pathlen, p, true);
  buf.write(path, p += 4, pathlen, 'utf8');

  return this._send(buf, cb);
};

SFTP.prototype.lstat = function(path, cb) {
  /*
    uint32     id
    string     path
  */
  var pathlen = Buffer.byteLength(path),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + pathlen);
  buf[4] = REQUEST.LSTAT;
  buf.writeUInt32BE(pathlen, p, true);
  buf.write(path, p += 4, pathlen, 'utf8');

  return this._send(buf, cb);
};

SFTP.prototype.opendir = function(path, cb) {
  /*
    uint32     id
    string     path
  */
  var pathlen = Buffer.byteLength(path),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + pathlen);
  buf[4] = REQUEST.OPENDIR;
  buf.writeUInt32BE(pathlen, p, true);
  buf.write(path, p += 4, pathlen, 'utf8');

  return this._send(buf, cb);
};

SFTP.prototype.setstat = function(path, attrs, cb) {
  var flags = 0, attrBytes = 0;
  if (typeof attrs === 'object') {
    attrs = attrsToBytes(attrs);
    flags = attrs[0];
    attrBytes = attrs[1];
    attrs = attrs[2];
  } else if (typeof attrs === 'function')
    cb = attrs;

  /*
    uint32     id
    string     path
    ATTRS      attrs
  */
  var pathlen = Buffer.byteLength(path),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + pathlen + 4 + attrBytes);
  buf[4] = REQUEST.SETSTAT;
  buf.writeUInt32BE(pathlen, p, true);
  buf.write(path, p += 4, pathlen, 'utf8');
  buf.writeUInt32BE(flags, p += pathlen);
  if (flags) {
    p += 4;
    for (var i = 0, len = attrs.length; i < len; ++i)
      for (var j = 0, len2 = attrs[i].length; j < len2; ++j)
        buf[p++] = attrs[i][j];
  }

  return this._send(buf, cb);
};

SFTP.prototype.fsetstat = function(handle, attrs, cb) {
  var flags = 0, attrBytes = 0;

  if (!Buffer.isBuffer(handle))
    throw new Error('handle is not a Buffer');

  if (typeof attrs === 'object') {
    attrs = attrsToBytes(attrs);
    flags = attrs[0];
    attrBytes = attrs[1];
    attrs = attrs[2];
  } else if (typeof attrs === 'function')
    cb = attrs;

  /*
    uint32     id
    string     handle
    ATTRS      attrs
  */
  var handlelen = Buffer.byteLength(handle),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + handlelen + 4 + attrBytes);
  buf[4] = REQUEST.FSETSTAT;
  buf.writeUInt32BE(handlelen, p, true);
  handle.copy(buf, p += 4);
  buf.writeUInt32BE(flags, p += handlelen);
  if (flags) {
    p += 4;
    for (var i = 0, len = attrs.length; i < len; ++i)
      for (var j = 0, len2 = attrs[i].length; j < len2; ++j)
        buf[p++] = attrs[i][j];
  }

  return this._send(buf, cb);
};

SFTP.prototype.futimes = function(handle, atime, mtime, cb) {
  return this.fsetstat(handle, {
    atime: toUnixTimestamp(atime),
    mtime: toUnixTimestamp(mtime)
  }, cb);
};

SFTP.prototype.utimes = function(path, atime, mtime, cb) {
  return this.setstat(path, {
    atime: toUnixTimestamp(atime),
    mtime: toUnixTimestamp(mtime)
  }, cb);
};

SFTP.prototype.fchown = function(handle, uid, gid, cb) {
  return this.fsetstat(handle, {
    uid: uid,
    gid: gid
  }, cb);
};

SFTP.prototype.chown = function(path, uid, gid, cb) {
  return this.setstat(path, {
    uid: uid,
    gid: gid
  }, cb);
};

SFTP.prototype.fchmod = function(handle, mode, cb) {
  return this.fsetstat(handle, {
    mode: mode
  }, cb);
};

SFTP.prototype.chmod = function(path, mode, cb) {
  return this.setstat(path, {
    mode: mode
  }, cb);
};

SFTP.prototype.readlink = function(path, cb) {
  /*
    uint32     id
    string     path
  */
  var pathlen = Buffer.byteLength(path),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + pathlen);
  buf[4] = REQUEST.READLINK;
  buf.writeUInt32BE(pathlen, p, true);
  buf.write(path, p += 4, pathlen, 'utf8');

  return this._send(buf, function(err, names) {
    if (err)
      return cb(err);
    cb(undefined, names[0].filename);
  });
};

SFTP.prototype.symlink = function(targetPath, linkPath, cb) {
  /*
    uint32     id
    string     linkpath
    string     targetpath
  */
  var linklen = Buffer.byteLength(linkPath),
      targetlen = Buffer.byteLength(targetPath),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + linklen + 4 + targetlen);
  buf[4] = REQUEST.SYMLINK;
  buf.writeUInt32BE(targetlen, p, true);
  buf.write(targetPath, p += 4, targetlen, 'utf8');
  buf.writeUInt32BE(linklen, p += targetlen, true);
  buf.write(linkPath, p += 4, linklen, 'utf8');

  return this._send(buf, cb);
};

SFTP.prototype.realpath = function(path, cb) {
  /*
    uint32     id
    string     path
  */
  var pathlen = Buffer.byteLength(path),
      p = 9,
      buf = new Buffer(4 + 1 + 4 + 4 + pathlen);
  buf[4] = REQUEST.REALPATH;
  buf.writeUInt32BE(pathlen, p, true);
  buf.write(path, p += 4, pathlen, 'utf8');

  return this._send(buf, function(err, names) {
    if (err)
      return cb(err);
    cb(undefined, names[0].filename);
  });
};

// used by writeFile and appendFile
SFTP.prototype._writeAll = function(handle, buf, offset, len, pos, cb) {
  var self = this;

  this.write(handle, buf, offset, len, pos, function(err, written) {
    if (err) {
      self.close(handle, function() {
        cb && cb(err);
      });
    } else {
      if (written === len)
        self.close(handle, cb);
      else {
        offset += written;
        len -= written;
        pos += written;
        self._writeAll(handle, buf, offset, len, pos, cb);
      }
    }
  });
};

SFTP.prototype._send = function(data, cb, buffer) {
  var err;
  if (this._reqid === MAX_REQID && !this._reqidmaxed) {
    this._reqid = 0;
    this._reqidmaxed = true;
  }
  if (this._reqidmaxed) {
    var found = false, i = 0;
    for (; i < MAX_REQID; ++i) {
      if (!this._requests[i]) {
        this._reqid = i;
        found = true;
        break;
      }
    }
    if (!found) {
      err = new Error('Exhausted available SFTP request IDs');
      if (typeof cb === 'function')
        cb(err);
      else
        this.emit('error', err);
      return;
    }
  }

  if (!this._stream.writable) {
    err = new Error('Underlying stream not writable');
    if (typeof cb === 'function')
      cb(err);
    else
      this.emit('error', err);
    return;
  }

  if (typeof cb !== 'function')
    cb = EMPTY_CALLBACK;

  this._requests[this._reqid] = { cb: cb, buffer: buffer };

  /*
    uint32             length
    byte               type
    byte[length - 1]   data payload
  */
  data.writeUInt32BE(data.length - 4, 0, true);
  data.writeUInt32BE(this._reqid++, 5, true);

  return this._stream.write(data);
};

SFTP.prototype._init = function() {
  /*
    uint32 version
    <extension data>
  */
  if (!this._stream.writable) {
    var err = new Error('Underlying stream not writable');
    return this.emit('error', err);
  }

  return this._stream.write(VERSION_BUFFER);
};

SFTP.prototype._parse = function(chunk) {
  var data = this._data, chunklen = chunk.length, cb;
  chunk.i = 0;
  while (chunk.i < chunklen) {
    if (data.type === 'discard')
      --data.len;
    else if (this._field === 'packet_length') {
      if ((data.len = this._readUInt32BE(chunk)) !== false)
        this._field = 'type';
    } else if (this._field === 'type') {
      --data.len;
      data.type = chunk[chunk.i];
      if (!data.type)
        throw new Error('Unsupported packet type: ' + chunk[chunk.i]);
      this._field = 'payload';
    } else if (data.type === RESPONSE.VERSION) {
      /*
        uint32 version
        <extension data>
      */
      if (!data.subtype) {
        if ((data.version = this._readUInt32BE(chunk)) !== false) {
          if (data.version !== 3)
            return this.emit('error', new Error('Incompatible SFTP version'));
          //data.subtype = 'extension';
          data.type = 'discard';
          this.emit('ready');
        }
      } else if (data.subtype === 'extension') {
        // TODO
      }
    } else if (data.type === RESPONSE.STATUS) {
      /*
        uint32     id
        uint32     error/status code
        string     error message (ISO-10646 UTF-8)
        string     language tag
      */
      if (!data.subtype) {
        if ((data.reqid = this._readUInt32BE(chunk)) !== false)
          data.subtype = 'status code';
      } else if (data.subtype === 'status code') {
        if ((data.statusCode = this._readUInt32BE(chunk)) !== false)
          data.subtype = 'error message';
      } else if (data.subtype === 'error message') {
        if ((data.errMsg = this._readString(chunk, 'utf8')) !== false)
          data.subtype = 'language';
      } else if (data.subtype === 'language') {
        if ((data.lang = this._readString(chunk, 'utf8')) !== false) {
          data.type = 'discard';
          cb = this._requests[data.reqid].cb;
          delete this._requests[data.reqid];
          if (data.statusCode === STATUS_CODE.OK)
            cb();
          else if (data.statusCode === STATUS_CODE.EOF)
            cb(undefined, false);
          else {
            var err = new Error(data.errMsg);
            err.type = STATUS_CODE[data.statusCode];
            err.lang = data.lang;
            cb(err);
          }
        }
      }
    } else if (data.type === RESPONSE.HANDLE) {
      /*
        uint32     id
        string     handle
      */
      if (!data.subtype) {
        if ((data.reqid = this._readUInt32BE(chunk)) !== false)
          data.subtype = 'handle blob';
      } else if (data.subtype === 'handle blob') {
        if ((data.handle = this._readString(chunk)) !== false) {
          data.type = 'discard';
          cb = this._requests[data.reqid].cb;
          delete this._requests[data.reqid];
          cb(undefined, data.handle);
        }
      }
    } else if (data.type === RESPONSE.DATA) {
      /*
        uint32     id
        string     data
      */
      if (!data.subtype) {
        if ((data.reqid = this._readUInt32BE(chunk)) !== false)
          data.subtype = 'data';
      } else if (data.subtype === 'data') {
        if ((data.data = this._readString(chunk)) !== false) {
          data.type = 'discard';
          cb = this._requests[data.reqid].cb;
          var nbytes = this._requests[data.reqid].nbytes;
          delete this._requests[data.reqid];
          cb(undefined, nbytes, data.data);
        }
      }
    } else if (data.type === RESPONSE.NAME) {
      /*
        uint32     id
        uint32     count
        repeats count times:
                string     filename
                string     longname
                ATTRS      attrs
      */
      if (!data.subtype) {
        if ((data.reqid = this._readUInt32BE(chunk)) !== false)
          data.subtype = 'count';
      } else if (data.subtype === 'count') {
        if ((data.count = this._readUInt32BE(chunk)) !== false) {
          data.names = new Array(data.count);
          if (data.count > 0) {
            data.c = 0;
            data.subtype = 'filename';
          } else {
            data.type = 'discard';
            cb = this._requests[data.reqid].cb;
            delete this._requests[data.reqid];
            cb(undefined, data.names);
          }
        }
      } else if (data.subtype === 'filename') {
        if (!data.names[data.c]) {
          data.names[data.c] = {
            filename: undefined,
            longname: undefined,
            attrs: undefined
          };
        }
        if ((data.names[data.c].filename = this._readString(chunk, 'utf8')) !== false)
          data.subtype = 'longname';
      } else if (data.subtype === 'longname') {
        if ((data.names[data.c].longname = this._readString(chunk, 'utf8')) !== false)
          data.subtype = 'attrs';
      } else if (data.subtype === 'attrs') {
        if ((data.names[data.c].attrs = this._readAttrs(chunk)) !== false) {
          if (++data.c < data.count)
            data.subtype = 'filename';
          else {
            data.type = 'discard';
            cb = this._requests[data.reqid].cb;
            delete this._requests[data.reqid];
            cb(undefined, data.names);
          }
        }
      }
    } else if (data.type === RESPONSE.ATTRS) {
      /*
        uint32     id
        ATTRS      attrs
      */
      if (!data.subtype) {
        if ((data.reqid = this._readUInt32BE(chunk)) !== false)
          data.subtype = 'attrs';
      } else if (data.subtype === 'attrs') {
        if ((data.attrs = this._readAttrs(chunk)) !== false) {
          data.type = 'discard';
          cb = this._requests[data.reqid].cb;
          delete this._requests[data.reqid];
          cb(undefined, data.attrs);
        }
      }
    } else if (data.type === RESPONSE.EXTENDED) {
      /*
        uint32     id
        string     extended-request
        ... any request-specific data ...
      */
      // TODO
      --data.len;
      data.type = 'discard';
    }

    if (data.len === 0 && this._field !== 'packet_length')
      this._reset();
    ++chunk.i;
  }
};

SFTP.prototype._readUInt32BE = function(chunk) {
  this._value <<= 8;
  this._value += chunk[chunk.i];
  --this._data.len;
  if (++this._count === 4) {
    var val = this._value;
    this._count = 0;
    this._value = 0;
    return val;
  }
  return false;
};

SFTP.prototype._readUInt64BE = function(chunk) {
  this._value *= 256;
  this._value += chunk[chunk.i];
  --this._data.len;
  if (++this._count === 8) {
    var val = this._value;
    this._count = 0;
    this._value = 0;
    return val;
  }
  return false;
};

SFTP.prototype._readString = function(chunk, encoding) {
  if (this._count < 4 && this._string === undefined) {
    this._value <<= 8;
    this._value += chunk[chunk.i];
    if (++this._count === 4) {
      this._data.len -= 4;
      this._count = 0;
      if (this._value === 0) {
        if (!encoding) {
          if (Buffer.isBuffer(this._requests[this._data.reqid].buffer))
            this._requests[this._data.reqid].nbytes = 0;
          return new Buffer(0);
        } else
          return '';
      }
      if (!encoding) {
        if (Buffer.isBuffer(this._requests[this._data.reqid].buffer)) {
          this._string = this._requests[this._data.reqid].buffer;
          this._requests[this._data.reqid].nbytes = this._value;
        } else
          this._string = new Buffer(this._value);
      } else
        this._string = '';
    }
  } else if (this._string !== undefined) {
    if (this._value <= chunk.length - chunk.i) {
      // rest of string is in the chunk
      var str;
      if (!encoding) {
        chunk.copy(this._string, this._count, chunk.i, chunk.i + this._value);
        str = this._string;
      } else {
        str = this._string + chunk.toString(encoding || 'ascii', chunk.i,
                                            chunk.i + this._value);
      }
      chunk.i += this._value - 1;
      this._data.len -= this._value;
      this._string = undefined;
      this._value = 0;
      this._count = 0;
      return str;
    } else {
      // only part or none of string in rest of chunk
      var diff = chunk.length - chunk.i;
      if (diff > 0) {
        if (!encoding) {
          chunk.copy(this._string, this._count, chunk.i);
          this._count += diff;
        } else
          this._string += chunk.toString(encoding || 'ascii', chunk.i);
        chunk.i = chunk.length;
        this._data.len -= diff;
        this._value -= diff;
      }
    }
  }

  return false;
};

SFTP.prototype._readAttrs = function(chunk) {
  /*
    uint32   flags
    uint64   size           present only if flag SSH_FILEXFER_ATTR_SIZE
    uint32   uid            present only if flag SSH_FILEXFER_ATTR_UIDGID
    uint32   gid            present only if flag SSH_FILEXFER_ATTR_UIDGID
    uint32   permissions    present only if flag SSH_FILEXFER_ATTR_PERMISSIONS
    uint32   atime          present only if flag SSH_FILEXFER_ACMODTIME
    uint32   mtime          present only if flag SSH_FILEXFER_ACMODTIME
    uint32   extended_count present only if flag SSH_FILEXFER_ATTR_EXTENDED
    string   extended_type
    string   extended_data
    ...      more extended data (extended_type - extended_data pairs),
               so that number of pairs equals extended_count
  */
  var data = this._data;
  if (!data._attrs)
    data._attrs = new Stats();

  if (typeof data._flags !== 'number')
    data._flags = this._readUInt32BE(chunk);
  else if (data._flags & ATTR.SIZE) {
    if ((data._attrs.size = this._readUInt64BE(chunk)) !== false)
      data._flags &= ~ATTR.SIZE;
  } else if (data._flags & ATTR.UIDGID) {
    if (typeof data._attrs.uid !== 'number')
      data._attrs.uid = this._readUInt32BE(chunk);
    else if ((data._attrs.gid = this._readUInt32BE(chunk)) !== false)
      data._flags &= ~ATTR.UIDGID;
  } else if (data._flags & ATTR.PERMISSIONS) {
    if ((data._attrs.mode = this._readUInt32BE(chunk)) !== false) {
      data._flags &= ~ATTR.PERMISSIONS;
      // backwards compatibility
      data._attrs.permissions = data._attrs.mode;
    }
  } else if (data._flags & ATTR.ACMODTIME) {
    if (typeof data._attrs.atime !== 'number')
      data._attrs.atime = this._readUInt32BE(chunk);
    else if ((data._attrs.mtime = this._readUInt32BE(chunk)) !== false)
      data._flags &= ~ATTR.ACMODTIME;
  } else if (data._flags & ATTR.EXTENDED) {
    //data._flags &= ~ATTR.EXTENDED;
    data._flags = 0;
    /*if (typeof data._attrsnExt !== 'number')
      data._attrsnExt = this._readUInt32BE(chunk);*/
  }

  if (data._flags === 0) {
    var ret = data._attrs;
    data._flags = undefined;
    data._attrs = undefined;
    return ret;
  }

  return false;
};

SFTP.prototype._reset = function() {
  this._count = 0;
  this._value = 0;
  this._string = undefined;
  this._field = 'packet_length';

  this._data.len = 0;
  this._data.type = undefined;
  this._data.subtype = undefined;
  this._data.reqid = undefined;
  this._data.version = undefined;
  this._data.statusCode = undefined;
  this._data.errMsg = undefined;
  this._data.lang = undefined;
  this._data.handle = undefined;
  this._data.data = undefined;
  this._data.count = undefined;
  this._data.names = undefined;
  this._data.c = undefined;
  this._data.attrs = undefined;
  this._data._attrs = undefined;
  this._data._flags = undefined;
};

var ATTR = {
  SIZE: 0x00000001,
  UIDGID: 0x00000002,
  PERMISSIONS: 0x00000004,
  ACMODTIME: 0x00000008,
  EXTENDED: 0x80000000
};

var STATUS_CODE = {
  OK: 0,
  EOF: 1,
  NO_SUCH_FILE: 2,
  PERMISSION_DENIED: 3,
  FAILURE: 4,
  BAD_MESSAGE: 5,
  NO_CONNECTION: 6,
  CONNECTION_LOST: 7,
  OP_UNSUPPORTED: 8
};
for (var i=0,keys=Object.keys(STATUS_CODE),len=keys.length; i<len; ++i)
  STATUS_CODE[STATUS_CODE[keys[i]]] = keys[i];

var REQUEST = {
  INIT: 1,
  OPEN: 3,
  CLOSE: 4,
  READ: 5,
  WRITE: 6,
  LSTAT: 7,
  FSTAT: 8,
  SETSTAT: 9,
  FSETSTAT: 10,
  OPENDIR: 11,
  READDIR: 12,
  REMOVE: 13,
  MKDIR: 14,
  RMDIR: 15,
  REALPATH: 16,
  STAT: 17,
  RENAME: 18,
  READLINK: 19,
  SYMLINK: 20
};
for (var i=0,keys=Object.keys(REQUEST),len=keys.length; i<len; ++i)
  REQUEST[REQUEST[keys[i]]] = keys[i];
var RESPONSE = {
  VERSION: 2,
  STATUS: 101,
  HANDLE: 102,
  DATA: 103,
  NAME: 104,
  ATTRS: 105,
  EXTENDED: 201
};
for (var i=0,keys=Object.keys(RESPONSE),len=keys.length; i<len; ++i)
  RESPONSE[RESPONSE[keys[i]]] = keys[i];

var OPEN_MODE = {
  READ: 0x00000001,
  WRITE: 0x00000002,
  APPEND: 0x00000004,
  CREAT: 0x00000008,
  TRUNC: 0x00000010,
  EXCL: 0x00000020
};

function attrsToBytes(attrs) {
  var flags = 0, attrBytes = 0, ret = [], i = 0;

  if (typeof attrs.size === 'number') {
    flags |= ATTR.SIZE;
    attrBytes += 8;
    var sizeBytes = new Array(8), val = attrs.size;
    for (i = 7; i >= 0; --i) {
      sizeBytes[i] = val & 0xFF;
      val /= 256;
    }
    ret.push(sizeBytes);
  }
  if (typeof attrs.uid === 'number' && typeof attrs.gid === 'number') {
    flags |= ATTR.UIDGID;
    attrBytes += 8;
    ret.push([(attrs.uid >> 24) & 0xFF, (attrs.uid >> 16) & 0xFF,
              (attrs.uid >> 8) & 0xFF, attrs.uid & 0xFF]);
    ret.push([(attrs.gid >> 24) & 0xFF, (attrs.gid >> 16) & 0xFF,
              (attrs.gid >> 8) & 0xFF, attrs.gid & 0xFF]);
  }
  if (typeof attrs.permissions === 'number'
      || typeof attrs.permissions === 'string'
      || typeof attrs.mode === 'number'
      || typeof attrs.mode === 'string') {
    var mode = modeNum(attrs.mode || attrs.permissions);
    flags |= ATTR.PERMISSIONS;
    attrBytes += 4;
    ret.push([(mode >> 24) & 0xFF,
              (mode >> 16) & 0xFF,
              (mode >> 8) & 0xFF,
              mode & 0xFF]);
  }
  if ((typeof attrs.atime === 'number' || isDate(attrs.atime))
      && (typeof attrs.mtime === 'number' || isDate(attrs.mtime))) {
    var atime = toUnixTimestamp(attrs.atime),
        mtime = toUnixTimestamp(attrs.mtime);
    flags |= ATTR.ACMODTIME;
    attrBytes += 8;
    ret.push([(atime >> 24) & 0xFF, (atime >> 16) & 0xFF,
              (atime >> 8) & 0xFF, atime & 0xFF]);
    ret.push([(mtime >> 24) & 0xFF, (mtime >> 16) & 0xFF,
              (mtime >> 8) & 0xFF, mtime & 0xFF]);
  }
  // TODO: extended attributes

  return [flags, attrBytes, ret];
}

function toUnixTimestamp(time) {
  if (typeof time === 'number' && !isNaN(time))
    return time;
  else if (isDate(time))
    return time.getTime() / 1000;
  throw new Error('Cannot parse time: ' + time);
}

function modeNum(mode) {
  if (typeof mode === 'number' && !isNaN(mode))
    return mode;
  else if (typeof mode === 'string')
    return modeNum(parseInt(mode, 8));
  throw new Error('Cannot parse mode: ' + mode);
}


// Read and write stream-related ....

var kMinPoolSpace = 128,
    kPoolSize = 40 * 1024,
    pool;

function allocNewPool() {
  pool = new Buffer(kPoolSize);
  pool.used = 0;
}

function ReadStream(sftp, path, opts) {
  var self = this;
  this._sftp = sftp;

  this.path = path;

  if (typeof this.path !== 'string')
    throw new Error('path must be a string');

  opts = opts || {};

  this.readable = true;
  this.paused = false;
  this.reading = false;
  this.flags = opts.flags || 'r';
  this.mode = opts.mode || 438; /*=0666*/
  this.bufferSize = opts.bufferSize || (64 * 1024);
  this.end = undefined;
  this.pos = 0;
  this.handle = undefined;
  this.buffer = undefined;

  if (opts.encoding)
    this._decoder = this.setEncoding(opts.encoding);
  else
    this._decoder = undefined;

  if (opts.start !== undefined) {
    if (typeof opts.start !== 'number')
      throw new TypeError('start must be a Number');

    if (opts.end === undefined)
      this.end = Infinity;
    else if (typeof opts.end !== 'number')
      throw new TypeError('end must be a Number');
    else
      this.end = opts.end;

    if (opts.start > opts.end)
      throw new Error('start must be <= end');
    else if (opts.start < 0)
      throw new Error('start must be >= zero');

    this.pos = opts.start;
    this.end = opts.end;
  }

  sftp.open(this.path, this.flags, this.mode, function(err, handle) {
    if (err) {
      self.emit('error', err);
      self.readable = false;
      return;
    }
    self.handle = handle;
    self.emit('open', handle);
    self._read();
  });

  sftp._stream._channel._conn._sock.once('end', function() {
    self.readable = false;
  });
  sftp._stream._channel._conn._sock.once('close', function() {
    self.readable = false;
  });
}
inherits(ReadStream, Stream);

ReadStream.prototype._read = function() {
  var self = this;
  if (!this.readable || this.paused || this.reading) return;

  this.reading = true;

  if (!pool || pool.length - pool.used < kMinPoolSpace) {
    // discard the old pool. Can't add to the free list because
    // users might have references to slices on it.
    pool = undefined;
    allocNewPool();
  }

  // Grab another reference to the pool in the case that while we're in the
  // thread pool another read() finishes up the pool, and allocates a new
  // one.
  var thisPool = pool,
      toRead,
      bufSize = ~~this.bufferSize,
      diff = pool.length - pool.used,
      start = pool.used;

  if (diff < bufSize)
    toRead = diff;
  else
    toRead = bufSize;

  if (this.pos !== undefined && this.end !== undefined) {
    diff = this.end - this.pos + 1;
    if (diff < toRead)
      toRead = diff;
  }

  function afterRead(err, bytesRead) {
    self.reading = false;
    if (err) {
      self._sftp.close(self.handle, function(err) {
        self.handle = undefined;
        self.emit('error', err);
        self.readable = false;
      });
      return;
    }

    if (bytesRead === 0) {
      self.emit('end');
      self.destroy();
      return;
    }

    var b = thisPool.slice(start, start + bytesRead);

    // Possible optimizition here?
    // Reclaim some bytes if bytesRead < toRead?
    // Would need to ensure that pool === thisPool.

    // do not emit events if the stream is paused
    if (self.paused) {
      self.buffer = b;
      return;
    }

    // do not emit events anymore after we declared the stream unreadable
    if (!self.readable)
      return;

    self._emitData(b);
    self._read();
  }

  this._sftp.read(this.handle, pool, pool.used, toRead, this.pos, afterRead);

  this.pos += toRead;
  pool.used += toRead;
};

ReadStream.prototype._emitData = function(d) {
  if (this._decoder) {
    var string = this._decoder.write(d);
    if (string.length)
      this.emit('data', string);
  } else
    this.emit('data', d);
};

ReadStream.prototype.pause = function() {
  this.paused = true;
};

ReadStream.prototype.resume = function() {
  this.paused = false;

  if (this.buffer) {
    var buffer = this.buffer;
    this.buffer = undefined;
    this._emitData(buffer);
  }

  // hasn't opened yet.
  if (this.handle === undefined)
    return;

  this._read();
};

ReadStream.prototype.destroy = function(cb) {
  var self = this;

  this._decoder = undefined;

  if (!this.readable) {
    cb && process.nextTick(cb);
    return;
  }
  this.readable = false;

  function close() {
    self.buffer = undefined;
    self._sftp.close(self.handle, function(err) {
      if (err) {
        cb && cb(err);
        self.emit('error', err);
        return;
      }

      cb && cb();
      self.emit('close');
    });
  }

  if (this.handle === undefined)
    this.once('open', close);
  else
    close();
};

ReadStream.prototype.setEncoding = function(encoding) {
  var StringDecoder = require('string_decoder').StringDecoder; // lazy load
  this._decoder = new StringDecoder(encoding);
};


function WriteStream(sftp, path, opts) {
  var self = this;
  this._sftp = sftp;

  this.path = path;

  if (typeof this.path !== 'string')
    throw new TypeError('path must be a String');

  opts = opts || {};
  this.handle = undefined;
  this.writable = true;

  this.flags = opts.flags || 'w';
  this.mode = opts.mode || 438; /*=0666*/
  this.bytesWritten = 0;
  this.pos = 0;
  if (typeof opts.autoClose === 'boolean')
    this.autoClose = opts.autoClose;
  else
    this.autoClose = true;

  if (opts.start !== undefined) {
    if (typeof opts.start !== 'number')
      throw new TypeError('start must be a Number');
    if (opts.start < 0)
      throw new Error('start must be >= zero');

    this.pos = opts.start;
  }

  this.drainable = false;
  this.busy = false;
  this._queue = [[this._sftp.open, this.path, this.flags, { mode: this.mode },
                    undefined]];
  if (this.flags[0] === 'a')
      this._queue.push([this._sftp.fstat, undefined]);

  this.flush();

  sftp._stream._channel._conn._sock.once('end', function() {
    self.writable = false;
  });
  sftp._stream._channel._conn._sock.once('close', function() {
    self.writable = false;
  });
  this.on('pipe', function() {
    self.piping = true;
  });
  this.on('unpipe', function() {
    self.piping = false;
  });
}
inherits(WriteStream, Stream);

WriteStream.prototype.flush = function() {
  if (this.busy)
    return;

  var self = this;

  var args = this._queue.shift();
  if (!args) {
    if (this.drainable)
      this.emit('drain');
    return;
  }

  this.busy = true;

  var method = args.shift(),
      cb = args.pop();

  args.push(function(err, arg1) {
    self.busy = false;

    if (err && method !== self._sftp.fstat) {
      if (self.autoClose) {
        self.writable = false;
        function emit() {
          self.handle = undefined;
          cb && cb(err);
          self.emit('error', err);
        }
        if (self.handle === undefined)
          emit();
        else
          self._sftp.close(self.handle, emit);
      } else {
        cb && cb(err);
        self.emit('error', err);
      }
      return;
    }

    if (method === self._sftp.fstat) {
      self.pos = arg1.size;
      cb && cb();
    } else if (method === self._sftp.write) {
      self.bytesWritten += arg1;
      self.pos += arg1;
      cb && cb(undefined, arg1);
    } else if (method === self._sftp.open) {
      // save reference for file handle
      self.handle = arg1;
      self.emit('open', self.handle);
    } else if (method === self._sftp.close) {
      // stop flushing after close
      cb && cb();
      self.emit('close');
      return;
    }

    self.flush();
  });

  // Inject the file pointer
  if (method !== this._sftp.open)
    args.unshift(this.handle);

  // simulate append by using updated absolute file position -- this is because
  // write in version 3 of the SFTP protocol requires an offset
  if (this.flags[0] === 'a' && method === this._sftp.write)
    args[4] = this.pos;

  method.apply(this._sftp, args);
};

WriteStream.prototype.write = function(data, encoding, cb) {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = undefined;
  }
  if (typeof cb !== 'function')
    cb = undefined;

  if (!this.writable) {
    var err = new Error('stream not writable');
    this.emit('error', err);
    cb && cb(err);
    return false;
  }

  this.drainable = true;

  if (!Buffer.isBuffer(data)) {
    if (typeof encoding !== 'string')
      encoding = 'utf8';
    data = new Buffer('' + data, encoding);
  }

  this._queue.push([this._sftp.write, data, 0, data.length, this.pos, cb]);

  this.pos += data.length;

  this.flush();

  return false;
};

WriteStream.prototype.end = function(data, encoding, cb) {
  if (!this.writable) {
    var err = new Error('stream not writable');
    this.emit('error', err);
    cb && cb(err);
    return false;
  }

  var isClosing = (this.autoClose || !this.piping);

  if (typeof data === 'function')
    cb = data;
  else if (typeof encoding === 'function') {
    cb = encoding;
    if (isClosing)
      this.write(data);
    else
      this.write(data, cb);
  } else if (data) {
    if (isClosing)
      this.write(data, encoding);
    else
      this.write(data, encoding, cb);
  }

  if (isClosing) {
    this.writable = false;
    this._queue.push([this._sftp.close, cb]);
  }

  if (this.piping)
    this.piping = false;

  this.flush();
};

WriteStream.prototype.destroy = function(cb) {
  var self = this;

  if (!this.writable) {
    cb && process.nextTick(cb);
    return;
  }
  this.writable = false;

  function close() {
    if (self._queue.length)
      self._queue = [];
    self._sftp.close(self.handle, function(err) {
      if (err) {
        cb && cb(err);
        self.emit('error', err);
        return;
      }

      cb && cb();
      self.emit('close');
    });
  }

  if (this.handle === undefined)
    this.once('open', close);
  else
    close();
};

WriteStream.prototype.destroySoon = WriteStream.prototype.end;
