var inherits = require('util').inherits,
    EventEmitter = require('events').EventEmitter,
    Stream = require('stream');

var consts = require('./Parser.constants');

var MAX_WINDOW = 0x100000, // 1MB  (protocol supports up to Math.pow(2, 32) - 1)
    WINDOW_THRESH = MAX_WINDOW / 2,
    SIGNALS = ['ABRT', 'ALRM', 'FPE', 'HUP', 'ILL', 'INT', 'KILL', 'PIPE',
               'QUIT', 'SEGV', 'TERM', 'USR1', 'USR2'],
    MESSAGE = consts.MESSAGE,
    CHANNEL_EXTENDED_DATATYPE = consts.CHANNEL_EXTENDED_DATATYPE,
    TERMINAL_MODE = consts.TERMINAL_MODE;

var CUSTOM_EVENTS = [
  'CHANNEL_EOF',
  'CHANNEL_CLOSE',
  'CHANNEL_DATA',
  'CHANNEL_EXTENDED_DATA',
  'CHANNEL_WINDOW_ADJUST',
  'CHANNEL_SUCCESS',
  'CHANNEL_FAILURE',
  'CHANNEL_REQUEST'
], CUSTOM_EVENTS_LEN = CUSTOM_EVENTS.length;

function Channel(info, conn) {
  EventEmitter.call(this);

  var self = this;

  this.type = info.type;
  this.subtype = undefined;
  /*
    incoming and outgoing contain these properties:
    {
      id: undefined,
      window: undefined,
      packetSize: undefined,
      state: 'closed'
    }
  */
  this.incoming = info.incoming;
  this.outgoing = info.outgoing;

  this._conn = conn;
  this._stream = undefined;
  this._callbacks = [];

  var onDrain = function() {
    if (self._stream && !self._stream.paused)
      self._stream.emit('drain');
  };

  conn.on('drain', onDrain);

  conn._parser.once('CHANNEL_EOF:' + this.incoming.id, function() {
    self.incoming.state = 'eof';
    if (self._stream) {
      self._stream.emit('end');
      if (!self._stream.allowHalfOpen)
        self.close();
    }
  });

  conn._parser.once('CHANNEL_CLOSE:' + this.incoming.id, function() {
    self.incoming.state = 'closed';
    if (self.outgoing.state === 'open' || self.outgoing.state === 'eof')
      self.close();
    if (self.outgoing.state === 'closing')
      self.outgoing.state = 'closed';
    conn._channels.splice(conn._channels.indexOf(self.incoming.id), 1);
    if (self._stream) {
      var stream = self._stream;
      self._stream = undefined;
      stream.emit('close');
      conn.removeListener('drain', onDrain);
      stream._cleanup();
    }
    for (var i = 0; i < CUSTOM_EVENTS_LEN; ++i) {
      // Since EventEmitters do not actually *delete* event names in the
      // emitter's event array, we must do this manually so as not to leak
      // our custom, channel-specific event names.
      delete conn._parser._events[CUSTOM_EVENTS[i] + ':' + self.incoming.id];
    }
  });

  conn._parser.on('CHANNEL_DATA:' + this.incoming.id, function(data) {
    self.incoming.window -= data.length;
    if (self.incoming.window <= WINDOW_THRESH)
      self._sendWndAdjust();
    if (self._stream) {
      if (self._stream._decoder)
        data = self._stream._decoder.write(data);
      self._stream.emit('data', data);
    }
  });

  conn._parser.on('CHANNEL_EXTENDED_DATA:' + this.incoming.id,
    function(type, data) {
      self.incoming.window -= data.length;
      if (self.incoming.window <= WINDOW_THRESH)
        self._sendWndAdjust();
      if (self._stream) {
        if (self._stream._decoder)
          data = self._stream._decoder.write(data);
        type = CHANNEL_EXTENDED_DATATYPE[type].toLowerCase();
        self._stream.emit('data', data, type);
      }
    }
  );

  conn._parser.on('CHANNEL_WINDOW_ADJUST:' + this.incoming.id, function(amt) {
    // the server is allowing us to send `amt` more bytes of data
    self.outgoing.window += amt;
    if (self._stream && self._stream.outpaused) {
      self._stream.outpaused = false;
      self._stream._drainOutBuffer();
    }
  });

  conn._parser.on('CHANNEL_SUCCESS:' + this.incoming.id, function() {
    if (self._callbacks.length)
      self._callbacks.shift()(false);
  });

  conn._parser.on('CHANNEL_FAILURE:' + this.incoming.id, function() {
    if (self._callbacks.length)
      self._callbacks.shift()(true);
  });

  conn._parser.on('CHANNEL_REQUEST:' + this.incoming.id, function(info) {
    if (self._stream) {
      if (info.request === 'exit-status')
        self._stream.emit('exit', info.code);
      else if (info.request === 'exit-signal') {
        self._stream.emit('exit', null, 'SIG' + info.signal, info.coredump,
                          info.description, info.lang);
      } else
        return;
      self.close();
    }
  });
}

Channel.prototype.eof = function() {
  if (this.outgoing.state === 'open') {
    this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent EOF');
    // Note: CHANNEL_EOF does not consume window space
    /*
      byte      SSH_MSG_CHANNEL_EOF
      uint32    recipient channel
    */
    var buf = new Buffer(1 + 4);
    this.outgoing.state = 'eof';
    buf[0] = MESSAGE.CHANNEL_EOF;
    buf.writeUInt32BE(this.outgoing.id, 1, true);
    return this._conn._send(buf);
  } else
    return;
};

Channel.prototype.close = function() {
  if (this.outgoing.state === 'open' || this.outgoing.state === 'eof') {
    this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CLOSE');
    // Note: CHANNEL_CLOSE does not consume window space
    /*
      byte      SSH_MSG_CHANNEL_CLOSE
      uint32    recipient channel
    */
    var buf = new Buffer(1 + 4);
    buf[0] = MESSAGE.CHANNEL_CLOSE;
    buf.writeUInt32BE(this.outgoing.id, 1, true);
    this.outgoing.state = 'closing';
    return this._conn._send(buf);
  } else
    return;
};

Channel.prototype._sendTermSizeChg = function(rows, cols, height, width) {
  // Note: CHANNEL_REQUEST does not consume window space
  /*
    byte      SSH_MSG_CHANNEL_REQUEST
    uint32    recipient channel
    string    "window-change"
    boolean   FALSE
    uint32    terminal width, columns
    uint32    terminal height, rows
    uint32    terminal width, pixels
    uint32    terminal height, pixels
  */
  this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CHANNEL_REQUEST (window-change)');
  var buf = new Buffer(1 + 4 + 4 + 13 + 1 + 4 + 4 + 4 + 4);
  buf[0] = MESSAGE.CHANNEL_REQUEST;
  buf.writeUInt32BE(this.outgoing.id, 1, true);
  buf.writeUInt32BE(13, 5, true);
  buf.write('window-change', 9, 13, 'ascii');
  buf[22] = 0;
  buf.writeUInt32BE(cols, 23, true);
  buf.writeUInt32BE(rows, 27, true);
  buf.writeUInt32BE(width, 31, true);
  buf.writeUInt32BE(height, 35, true);

  return this._conn._send(buf);
};

Channel.prototype._sendPtyReq = function(rows, cols, height, width, term, modes,
                                         cb) {
  // Note: CHANNEL_REQUEST does not consume window space
  /*
    byte      SSH_MSG_CHANNEL_REQUEST
    uint32    recipient channel
    string    "pty-req"
    boolean   want_reply
    string    TERM environment variable value (e.g., vt100)
    uint32    terminal width, characters (e.g., 80)
    uint32    terminal height, rows (e.g., 24)
    uint32    terminal width, pixels (e.g., 640)
    uint32    terminal height, pixels (e.g., 480)
    string    encoded terminal modes
  */
  this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CHANNEL_REQUEST (pty-req)');
  if (!term || !term.length)
    term = 'vt100';
  if (!modes || !modes.length)
    modes = String.fromCharCode(TERMINAL_MODE.TTY_OP_END);
  var termLen = term.length,
      modesLen = modes.length,
      p = 21,
      buf = new Buffer(1 + 4 + 4 + 7 + 1 + 4 + termLen + 4 + 4 + 4 + 4 + 4
                       + modesLen);
  buf[0] = MESSAGE.CHANNEL_REQUEST;
  buf.writeUInt32BE(this.outgoing.id, 1, true);
  buf.writeUInt32BE(7, 5, true);
  buf.write('pty-req', 9, 7, 'ascii');
  buf[16] = 1;
  buf.writeUInt32BE(termLen, 17, true);
  buf.write(term, 21, termLen, 'utf8');
  buf.writeUInt32BE(cols, p += termLen, true);
  buf.writeUInt32BE(rows, p += 4, true);
  buf.writeUInt32BE(width, p += 4, true);
  buf.writeUInt32BE(height, p += 4, true);
  buf.writeUInt32BE(modesLen, p += 4, true);
  buf.write(modes, p += 4, modesLen, 'utf8');

  this._callbacks.push(function(had_err) {
    if (had_err)
      cb(new Error('Error: Unable to request a pseudo-terminal'));
    else
      cb();
  });

  return this._conn._send(buf);
};

Channel.prototype._sendShell = function(cb) {
  // Note: CHANNEL_REQUEST does not consume window space
  /*
    byte      SSH_MSG_CHANNEL_REQUEST
    uint32    recipient channel
    string    "shell"
    boolean   want reply
  */
  this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CHANNEL_REQUEST (shell)');
  var self = this;
  var buf = new Buffer(1 + 4 + 4 + 5 + 1);
  buf[0] = MESSAGE.CHANNEL_REQUEST;
  buf.writeUInt32BE(this.outgoing.id, 1, true);
  buf.writeUInt32BE(5, 5, true);
  buf.write('shell', 9, 5, 'ascii');
  buf[14] = 1;

  this._callbacks.push(function(had_err) {
    if (had_err)
      return cb(new Error('Error: Unable to open shell'));
    self.subtype = 'shell';
    self._stream = new ChannelStream(self);
    cb(undefined, self._stream);
  });

  return this._conn._send(buf);
};

Channel.prototype._sendExec = function(cmd, cb) {
  // Note: CHANNEL_REQUEST does not consume window space
  /*
    byte      SSH_MSG_CHANNEL_REQUEST
    uint32    recipient channel
    string    "exec"
    boolean   want reply
    string    command
  */
  this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CHANNEL_REQUEST (exec)');
  var self = this;
  var cmdlen = (Buffer.isBuffer(cmd) ? cmd.length : Buffer.byteLength(cmd)),
      buf = new Buffer(1 + 4 + 4 + 4 + 1 + 4 + cmdlen);
  buf[0] = MESSAGE.CHANNEL_REQUEST;
  buf.writeUInt32BE(this.outgoing.id, 1, true);
  buf.writeUInt32BE(4, 5, true);
  buf.write('exec', 9, 4, 'ascii');
  buf[13] = 1;
  buf.writeUInt32BE(cmdlen, 14, true);
  if (Buffer.isBuffer(cmd))
    cmd.copy(buf, 18);
  else
    buf.write(cmd, 18, cmdlen, 'utf8');

  this._callbacks.push(function(had_err) {
    if (had_err)
      return cb(new Error('Error: Unable to exec'));
    self.subtype = 'exec';
    self._stream = new ChannelStream(self);
    cb(undefined, self._stream);
  });

  return this._conn._send(buf);
};

Channel.prototype._sendSignal = function(signal) {
  // Note: CHANNEL_REQUEST does not consume window space
  /*
    byte      SSH_MSG_CHANNEL_REQUEST
    uint32    recipient channel
    string    "signal"
    boolean   FALSE
    string    signal name (without the "SIG" prefix)
  */
  this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CHANNEL_REQUEST (signal)');
  signal = signal.toUpperCase();
  if (signal.length >= 3
      && signal[0] === 'S' && signal[1] === 'I' && signal[2] === 'G')
    signal = signal.substr(3);
  if (SIGNALS.indexOf(signal) === -1)
    throw new Error('Invalid signal: ' + signal);
  var signalLen = signal.length,
      buf = new Buffer(1 + 4 + 4 + 6 + 1 + 4 + signalLen);
  buf[0] = MESSAGE.CHANNEL_REQUEST;
  buf.writeUInt32BE(this.outgoing.id, 1, true);
  buf.writeUInt32BE(6, 5, true);
  buf.write('signal', 9, 6, 'ascii');
  buf[15] = 0;
  buf.writeUInt32BE(signalLen, 16, true);
  buf.write(signal, 20, signalLen, 'ascii');

  return this._conn._send(buf);
};

Channel.prototype._sendEnv = function(env) {
  var keys, buf, ret = true;
  if (env && (keys = Object.keys(env)).length > 0) {
    this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CHANNEL_REQUEST (env)');
    // Note: CHANNEL_REQUEST does not consume window space
    /*
      byte      SSH_MSG_CHANNEL_REQUEST
      uint32    recipient channel
      string    "env"
      boolean   want reply
      string    variable name
      string    variable value
    */
    for (var i = 0, klen, vlen, len = keys.length; i < len; ++i) {
      klen = Buffer.byteLength(keys[i]);
      if (Buffer.isBuffer(env[keys[i]]))
        vlen = env[keys[i]].length;
      else
        vlen = Buffer.byteLength(env[keys[i]]);
      buf = new Buffer(1 + 4 + 4 + 3 + 1 + 4 + klen + 4 + vlen);
      buf[0] = MESSAGE.CHANNEL_REQUEST;
      buf.writeUInt32BE(this.outgoing.id, 1, true);
      buf.writeUInt32BE(3, 5, true);
      buf.write('env', 9, 3, 'ascii');
      buf[13] = 0;
      buf.writeUInt32BE(klen, 14, true);
      buf.write(keys[i], 18, klen, 'ascii');
      buf.writeUInt32BE(vlen, 18 + klen, true);
      if (Buffer.isBuffer(env[keys[i]]))
        env[keys[i]].copy(buf, 18 + klen + 4);
      else
        buf.write(env[keys[i]], 18 + klen + 4, vlen, 'utf8');
      ret = this._conn._send(buf);
    }
    return ret;
  } else
    return;
};

Channel.prototype._sendSubsystem = function(name, cb) {
  // Note: CHANNEL_REQUEST does not consume window space
  /*
    byte      SSH_MSG_CHANNEL_REQUEST
    uint32    recipient channel
    string    "subsystem"
    boolean   want reply
    string    subsystem name
  */
  this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CHANNEL_REQUEST (subsystem)');
  var sublen = Buffer.byteLength(name),
      self = this,
      buf = new Buffer(1 + 4 + 4 + 9 + 1 + 4 + sublen);
  buf[0] = MESSAGE.CHANNEL_REQUEST;
  buf.writeUInt32BE(this.outgoing.id, 1, true);
  buf.writeUInt32BE(9, 5, true);
  buf.write('subsystem', 9, 9, 'ascii');
  buf[18] = 1;
  buf.writeUInt32BE(sublen, 19, true);
  buf.write(name, 23, sublen, 'ascii');

  this._callbacks.push(function(had_err) {
    if (had_err)
      return cb(new Error('Error: Unable to start subsystem: ' + name));
    self.subtype = 'subsystem';
    self._stream = new ChannelStream(self);
    cb(undefined, self._stream);
  });

  return this._conn._send(buf);
};

Channel.prototype._sendData = function(data, extendedType) {
  var len = data.length, p = 0, buf, sliceLen, ret;

  while (len - p > 0 && this.outgoing.window > 0) {
    sliceLen = len - p;
    if (sliceLen > this.outgoing.window)
      sliceLen = this.outgoing.window;
    if (sliceLen > this.outgoing.packetSize)
      sliceLen = this.outgoing.packetSize;
    if (extendedType === undefined) {
      this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CHANNEL_DATA');
      /*
        byte      SSH_MSG_CHANNEL_DATA
        uint32    recipient channel
        string    data
      */
      buf = new Buffer(1 + 4 + 4 + sliceLen);
      buf[0] = MESSAGE.CHANNEL_DATA;
      buf.writeUInt32BE(this.outgoing.id, 1, true);
      buf.writeUInt32BE(sliceLen, 5, true);
      data.copy(buf, 9, p, p + sliceLen);
    } else {
      this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CHANNEL_EXTENDED_DATA');
      /*
        byte      SSH_MSG_CHANNEL_EXTENDED_DATA
        uint32    recipient channel
        uint32    data_type_code
        string    data
      */
      buf = new Buffer(1 + 4 + 4 + 4 + sliceLen);
      buf[0] = MESSAGE.CHANNEL_EXTENDED_DATA;
      buf.writeUInt32BE(this.outgoing.id, 1, true);
      buf.writeUInt32BE(extendedType, 5, true);
      buf.writeUInt32BE(sliceLen, 9, true);
      data.copy(buf, 13, p, p + sliceLen);
    }
    p += sliceLen;
    this.outgoing.window -= sliceLen;

    ret = this._conn._send(buf);
  }

  // Will we ever be in a "good" state and be sending data without a
  // ChannelStream?
  if (len - p > 0 && this._stream) {
    // buffer outbound data until server sends us a CHANNEL_WINDOW_ADJUST message
    if (p > 0) {
      // partial
      buf = new Buffer(len - p);
      data.copy(buf, 0, p);
      this._stream._outbuffer.push([buf, extendedType]);
    } else
      this._stream._outbuffer.push([data, extendedType]);
    if (ret)
      ret = false;
    this._stream.outpaused = true;
  }

  return ret;
};

Channel.prototype._sendWndAdjust = function(amt) {
  /*
    byte      SSH_MSG_CHANNEL_WINDOW_ADJUST
    uint32    recipient channel
    uint32    bytes to add
  */
  this._conn._debug&&this._conn._debug('DEBUG: Channel: Sent CHANNEL_WINDOW_ADJUST');
  amt = amt || MAX_WINDOW;
  var buf = new Buffer(1 + 4 + 4);
  buf[0] = MESSAGE.CHANNEL_WINDOW_ADJUST;
  buf.writeUInt32BE(this.outgoing.id, 1, true);
  buf.writeUInt32BE(amt, 5, true);

  this.incoming.window += amt;

  return this._conn._send(buf);
};

Channel.MAX_WINDOW = MAX_WINDOW;
Channel.ChannelStream = ChannelStream;

module.exports = Channel;



function ChannelStream(channel) {
  var self = this;
  this.readable = true;
  this.writable = true;
  this.paused = false;
  this.outpaused = false;
  this.allowHalfOpen = false;
  this._channel = channel;
  this._outbuffer = [];
  this._inbuffer = [];
  this._decoder = undefined;
  this._sockOnEnd = function() {
    self.writable = false;
    self.readable = false;
    channel._conn._sock.removeListener('end', self._sockOnEnd);
    channel._conn._sock.removeListener('close', self._sockOnEnd);
  };
  channel._conn._sock.once('end', this._sockOnEnd);
  channel._conn._sock.once('close', this._sockOnEnd);
}
inherits(ChannelStream, Stream);

ChannelStream.prototype._emit = ChannelStream.prototype.emit;
ChannelStream.prototype.emit = function(ev, arg1, arg2, arg3, arg4, arg5) {
  if (this.paused) {
    if (arg1 === undefined)
      this._inbuffer.push([ev]);
    else if (arg2 === undefined)
      this._inbuffer.push([ev, arg1]);
    else if (arg3 === undefined)
      this._inbuffer.push([ev, arg1, arg2]);
    else if (arg4 === undefined)
      this._inbuffer.push([ev, arg1, arg2, arg3]);
    else if (arg5 === undefined)
      this._inbuffer.push([ev, arg1, arg2, arg3, arg4]);
    else
      this._inbuffer.push([ev, arg1, arg2, arg3, arg4, arg5]);
  } else {
    if (ev === 'data' && this._decoder)
      this._emit(ev, this._decoder.write(arg1), arg2);
    else if (arg1 === undefined)
      this._emit(ev);
    else if (arg2 === undefined)
      this._emit(ev, arg1);
    else if (arg3 === undefined)
      this._emit(ev, arg1, arg2);
    else if (arg4 === undefined)
      this._emit(ev, arg1, arg2, arg3);
    else if (arg5 === undefined)
      this._emit(ev, arg1, arg2, arg3, arg4);
    else
      this._emit(ev, arg1, arg2, arg3, arg4, arg5);
  }
};

ChannelStream.prototype._drainInBuffer = function() {
  var i = 0, val, vallen, len = this._inbuffer.length;

  for (; i < len; ++i) {
    val = this._inbuffer[i];
    vallen = val.length;
    if (val[0] === 'data' && this._decoder)
      this._emit(val[0], this._decoder.write(val[1]), val[2]);
    else if (vallen === 1)
      this._emit(val[0]);
    else if (vallen === 2)
      this._emit(val[0], val[1]);
    else if (vallen === 3)
      this._emit(val[0], val[1], val[2]);
    else if (vallen === 4)
      this._emit(val[0], val[1], val[2], val[3]);
    else if (vallen === 5)
      this._emit(val[0], val[1], val[2], val[3], val[4]);
    else
      this._emit(val[0], val[1], val[2], val[3], val[4], val[5]);
  }
};

ChannelStream.prototype._drainOutBuffer = function() {
  if (!this.writable)
    return;
  var i = 0, len = this._outbuffer.length, ret = true;

  for (; i < len; ++i) {
    if (this._outbuffer[i] === null) {
      // end() was called
      ret = true;
      len = 0; // bypass length check
      this.destroy();
      break;
    } else if (this.outpaused)
      break;
    else
      ret = this._channel._sendData(this._outbuffer[i][0], this._outbuffer[i][1]);
  }

  // it's possible _sendData pushed more data into the outbuffer if we ran out
  // of window space while in the above for-loop. we check for that here ...
  if (len === this._outbuffer.length) {
    if (len)
      this._outbuffer = [];
  } else {
    this._outbuffer.splice(0, i);
    ret = false;
  }

  if (ret)
    this.emit('drain');

  return ret;
};

ChannelStream.prototype.write = function(data, encoding, extended) {
  if (!this.writable)
    throw new Error('ChannelStream is not writable');

  var extendedType;

  if (typeof data === 'string') {
    encoding = encoding || 'utf8';
    data = new Buffer(data, encoding);
  } else
    extended = encoding;

  if (Buffer.isBuffer(data)) {
    if (typeof extended === 'string') {
      extendedType = CHANNEL_EXTENDED_DATATYPE[extended.toUpperCase()];
      if (extendedType === undefined)
        throw new Error('Error: Invalid extended data type specified: '
                        + extended);
      extended = extendedType;
    } else if (extended && typeof extended !== 'number')
      throw new Error('Error: Unexpected extended type: ' + extended);

    if (this.outpaused) {
      this._outbuffer.push([data, extended]);
      return false;
    } else {
      if (extended)
        return this._channel._sendData(data);
      else
        return this._channel._sendData(data, extended);
    }
  } else
    throw new Error('Error: Unexpected data type: ' + typeof data);
};

ChannelStream.prototype.pause = function() {
  this.paused = true;
  this._channel._conn._sock.pause();
};

ChannelStream.prototype.resume = function() {
  this.paused = false;
  this._drainInBuffer();
  this._channel._conn._sock.resume();
};

ChannelStream.prototype.end = function(data, encoding, extended) {
  if (!this.writable)
    return;
  var ret;
  if (data && data.length)
    ret = this.write(data, encoding, extended);
  if (this.outpaused) {
    ret = this._outbuffer.push(null);
    this.resume();
  } else {
    ret = this._channel.eof();
    this.writable = false;
    if (!this.allowHalfOpen) {
      ret = this._channel.close();
      this.readable = false;
    }
  }

  return ret;
};

ChannelStream.prototype.destroy = function() {
  var ret;
  ret = this._channel.eof();
  ret = this._channel.close();
  this._cleanup();
  return ret;
};

ChannelStream.prototype._cleanup = function() {
  if (this._outbuffer.length)
    this._outbuffer = [];
  if (this._inbuffer.length)
    this._inbuffer = [];
  this._channel._conn._sock.removeListener('end', this._sockOnEnd);
  this._channel._conn._sock.removeListener('close', this._sockOnEnd);
  this.writable = false;
  this.readable = false;
  this.paused = false;
  this.outpaused = false;
  this._decoder = undefined;
  this._channel = undefined;
};

ChannelStream.prototype.setEncoding = function(encoding) {
  var StringDecoder = require('string_decoder').StringDecoder; // lazy load
  this._decoder = new StringDecoder(encoding);
};

// session type-specific methods

ChannelStream.prototype.setWindow = function(rows, cols, height, width) {
  if (this._channel.type === 'session' && this._channel.subtype === 'shell')
    return this._channel._sendTermSizeChg(rows, cols, height, width);
};

ChannelStream.prototype.signal = function(signalName) {
  if (this._channel.type === 'session'
      && (this._channel.subtype === 'shell' || this._channel.subtype === 'exec'))
    return this._channel._sendSignal(signalName);
};