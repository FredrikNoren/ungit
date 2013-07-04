// TODO: * Filter control codes from strings
//          (as per http://tools.ietf.org/html/rfc4251#section-9.2)

var crypto = require('crypto');
var StreamSearch = require('streamsearch');
var consts = require('./Parser.constants');
var inherits = require('util').inherits,
    EventEmitter = require('events').EventEmitter;

var MESSAGE = consts.MESSAGE,
    DISCONNECT_REASON = consts.DISCONNECT_REASON,
    CHANNEL_OPEN_FAILURE = consts.CHANNEL_OPEN_FAILURE,
    SSH_TO_OPENSSL = consts.SSH_TO_OPENSSL;

// parser states
var I = 0;
var STATE_INIT = I++,
    STATE_GREETING = I++,
    STATE_HEADER = I++,
    STATE_PACKETBEFORE = I++,
    STATE_PACKET = I++,
    STATE_PACKETDATA = I++,
    STATE_PACKETDATAVERIFY = I++,
    STATE_PACKETDATAAFTER = I++;

var MAX_SEQNO = 4294967295;

var EXP_TYPE_HEADER = 0,
    EXP_TYPE_LF = 1,
    EXP_TYPE_BYTES = 2; // waits until n bytes have been seen

function Parser() {
  this.debug = undefined;
  this._hmacBufCompute = new Buffer(9);
  this.reset();
}
inherits(Parser, EventEmitter);

Parser.prototype.execute = function(b, start, end) {
  start || (start = 0);
  end || (end = b.length);

  var i = start, buffer, skipDecrypt = false, buf, self = this, p = i;

  while (true) {
    if (this._expectType !== undefined) {
      if (i >= end)
        break;
      if (this._expectType === EXP_TYPE_BYTES) {
        if (this._expectBuf) {
          this._expectBuf[this._expectPtr++] = b[i++];
          if (this._expectPtr === this._expect) {
            buffer = this._expectBuf;
            this._expectBuf = undefined;
            this._expectPtr = 0;
            this._expectType = undefined;
          }
        } else
          ++i;
        continue;
      } else if (this._expectType === EXP_TYPE_HEADER) {
        this._ss.push(b);
        if (this._expectType !== undefined)
          continue;
      } else if (this._expectType === EXP_TYPE_LF) {
        if (b[i] === 0x0A) {
          this._expectType = undefined;
          if (p < i) {
            if (this._expectBuf === undefined)
              this._expectBuf = b.toString('ascii', p, i);
            else
              this._expectBuf += b.toString('ascii', p, i);
          }
          buffer = this._expectBuf;
          this._expectBuf = undefined;
          ++i;
        } else {
          if (++i === end && p < i) {
            if (this._expectBuf === undefined)
              this._expectBuf = b.toString('ascii', p, i);
            else
              this._expectBuf += b.toString('ascii', p, i);
          }
          continue;
        }
      }
    }

    if (this._state === STATE_INIT) {
        this.debug&&this.debug('DEBUG: Parser: STATE_INIT');
        // retrieve all bytes that may come before the header
        this.expect(EXP_TYPE_HEADER);
        this._ss = new StreamSearch(new Buffer('SSH-'));
        this._ss.on('info', function onInfo(matched, data, start, end) {
          if (data) {
            if (this._greeting === undefined)
              this._greeting = data.toString('binary', start, end);
            else
              this._greeting += data.toString('binary', start, end);
          }
          if (matched) {
            if (end !== undefined)
              i = end;
            else
              i += 4;
            self._expectType = undefined;
            self._ss.removeListener('info', onInfo);
          }
        });
        this._state = STATE_GREETING;
    } else if (this._state === STATE_GREETING) {
        this.debug&&this.debug('DEBUG: Parser: STATE_GREETING');
        this._ss = undefined;
        // retrieve the identification bytes after the "SSH-" header
        p = i;
        this.expect(EXP_TYPE_LF);
        this._state = STATE_HEADER;
    } else if (this._state === STATE_HEADER) {
        this.debug&&this.debug('DEBUG: Parser: STATE_HEADER');
        buffer = buffer.trim();
        var idxDash = buffer.indexOf('-'),
            idxSpace = buffer.indexOf(' ');
        var header = {
          // RFC says greeting SHOULD be utf8
          greeting: this._greeting,//(this._greeting ? this._greeting.toString('utf8') : null),
          ident_raw: 'SSH-' + buffer,
          versions: {
            protocol: buffer.substr(0, idxDash),
            server: (idxSpace === -1
                     ? buffer.substr(idxDash + 1)
                     : buffer.substring(idxDash + 1, idxSpace))
          },
          comments: (idxSpace > -1 ? buffer.substring(idxSpace + 1) : undefined)
        };
        this._greeting = undefined;
        this.emit('header', header);
        if (this._state === STATE_INIT) {
          // we reset from an event handler
          // possibly due to an unsupported SSH protocol version?
          return;
        }
        this._state = STATE_PACKETBEFORE;
    } else if (this._state === STATE_PACKETBEFORE) {
        this.debug&&this.debug('DEBUG: Parser: STATE_PACKETBEFORE (expecting ' + this._decryptSize + ')');
        // wait for the right number of bytes so we can determine the incoming
        // packet length
        this.expect(EXP_TYPE_BYTES, this._decryptSize, '_decryptBuf');
        this._state = STATE_PACKET;
    } else if (this._state === STATE_PACKET) {
        this.debug&&this.debug('DEBUG: Parser: STATE_PACKET');
        if (this._decrypt)
          buffer = this.decrypt(buffer);
        this._pktLen = buffer.readUInt32BE(0, true);
        this._padLen = buffer[4];
        var remainLen = this._pktLen + 4 - this._decryptSize;
        this.debug&&this.debug('DEBUG: Parser: remainLen === ' + remainLen);
        if (remainLen > 0) {
          this._pktExtra = buffer.slice(5);
          // grab the rest of the packet
          this.expect(EXP_TYPE_BYTES, remainLen);
          this._state = STATE_PACKETDATA;
        } else if (remainLen < 0)
          this._state = STATE_PACKETBEFORE;
        else {
          // entire message fit into one block
          skipDecrypt = true;
          this._state = STATE_PACKETDATA;
          continue;
        }
    } else if (this._state === STATE_PACKETDATA) {
        this.debug&&this.debug('DEBUG: Parser: STATE_PACKETDATA');
        if (this._decrypt && !skipDecrypt)
          buffer = this.decrypt(buffer);
        else if (skipDecrypt)
          skipDecrypt = false;
        var padStart = this._pktLen - this._padLen - 1;
        if (this._pktExtra) {
          buf = new Buffer(this._pktExtra.length + buffer.length);
          this._pktExtra.copy(buf);
          buffer.copy(buf, this._pktExtra.length);
          this._payload = buf.slice(0, padStart);
        } else {
          // entire message fit into one block
          buf = buffer.slice(5);
          this._payload = buffer.slice(5, 5 + padStart);
        }
        if (this._hmacSize !== undefined) {
          // wait for hmac hash
          this.debug&&this.debug('DEBUG: Parser: hmacSize === ' + this._hmacSize);
          this.expect(EXP_TYPE_BYTES, this._hmacSize, '_hmacBuf');
          this._state = STATE_PACKETDATAVERIFY;
          this._packet = buf;
        } else
          this._state = STATE_PACKETDATAAFTER;
        this._pktExtra = undefined;
        buf = undefined;
    } else if (this._state === STATE_PACKETDATAVERIFY) {
        this.debug&&this.debug('DEBUG: Parser: STATE_PACKETDATAVERIFY');
        // verify packet data integrity
        if (this.hmacVerify(buffer)) {
          this._state = STATE_PACKETDATAAFTER;
          this._packet = undefined;
        } else {
          this.emit('error', new Error('Invalid HMAC'));
          return this.reset();
        }
    } else if (this._state === STATE_PACKETDATAAFTER) {
        if (this.debug) {
          if (this._payload[0] === 60) {
            if (this._authMethod === 'password')
              this.debug('DEBUG: Parser: STATE_PACKETDATAAFTER, packet: USERAUTH_PASSWD_CHANGEREQ');
            else if (this._authMethod === 'keyboard-interactive')
              this.debug('DEBUG: Parser: STATE_PACKETDATAAFTER, packet: USERAUTH_INFO_REQUEST');
            else if (this._authMethod === 'pubkey')
              this.debug('DEBUG: Parser: STATE_PACKETDATAAFTER, packet: USERAUTH_PK_OK');
          } else {
            this.debug('DEBUG: Parser: STATE_PACKETDATAAFTER, packet: '
                       + MESSAGE[this._payload[0]]);
          }
        }
        this.parsePacket();
        if (this._state === STATE_INIT) {
          // we were reset due to some error/disagreement ?
          return;
        }
        this._state = STATE_PACKETBEFORE;
        this._payload = undefined;
    }
    if (buffer !== undefined)
      buffer = undefined;
  }
};

Parser.prototype.parseKEXInit = function() {
  var payload = this._payload;

  /*
    byte         SSH_MSG_KEXINIT
    byte[16]     cookie (random bytes)
    name-list    kex_algorithms
    name-list    server_host_key_algorithms
    name-list    encryption_algorithms_client_to_server
    name-list    encryption_algorithms_server_to_client
    name-list    mac_algorithms_client_to_server
    name-list    mac_algorithms_server_to_client
    name-list    compression_algorithms_client_to_server
    name-list    compression_algorithms_server_to_client
    name-list    languages_client_to_server
    name-list    languages_server_to_client
    boolean      first_kex_packet_follows
    uint32       0 (reserved for future extension)
  */
  var init = this._kexinit_info = {
    algorithms: {
      kex: undefined,
      srvHostKey: undefined,
      cs: {
        encrypt: undefined,
        mac: undefined,
        compress: undefined
      },
      sc: {
        encrypt: undefined,
        mac: undefined,
        compress: undefined
      }
    },
    languages: {
      cs: undefined,
      sc: undefined
    }
  };
  init.algorithms.kex = readList(payload, 17);
  init.algorithms.srvHostKey = readList(payload, payload._pos);
  init.algorithms.cs.encrypt = readList(payload, payload._pos);
  init.algorithms.sc.encrypt = readList(payload, payload._pos);
  init.algorithms.cs.mac = readList(payload, payload._pos);
  init.algorithms.sc.mac = readList(payload, payload._pos);
  init.algorithms.cs.compress = readList(payload, payload._pos);
  init.algorithms.sc.compress = readList(payload, payload._pos);
  init.languages.cs = readList(payload, payload._pos);
  init.languages.sc = readList(payload, payload._pos);
  this._kexinit = payload;
  this.emit('KEXINIT', init);
};

Parser.prototype.parseUserAuthMisc = function() {
  var payload = this._payload, message, lang;

  if (this._authMethod === 'password') {
    /*
      byte      SSH_MSG_USERAUTH_PASSWD_CHANGEREQ
      string    prompt in ISO-10646 UTF-8 encoding
      string    language tag
    */
    message = readString(payload, 1, 'utf8');
    lang = readString(payload, payload._pos, 'utf8');
    this.emit('USERAUTH_PASSWD_CHANGEREQ', message, lang);
  } else if (this._authMethod === 'keyboard-interactive') {
    /*
      byte      SSH_MSG_USERAUTH_INFO_REQUEST
      string    name (ISO-10646 UTF-8)
      string    instruction (ISO-10646 UTF-8)
      string    language tag -- MAY be empty
      int       num-prompts
      string    prompt[1] (ISO-10646 UTF-8)
      boolean   echo[1]
      ...
      string    prompt[num-prompts] (ISO-10646 UTF-8)
      boolean   echo[num-prompts]
    */
    var name, instr, nprompts;

    name = readString(payload, 1, 'utf8');
    instr = readString(payload, payload._pos, 'utf8');
    lang = readString(payload, payload._pos, 'utf8');
    nprompts = payload.readUInt32BE(payload._pos, true);

    payload._pos += 4;
    if (nprompts > 0) {
      var prompts = new Array(nprompts);
      for (var prompt = 0; prompt < nprompts; ++prompt) {
        prompts.push({
          prompt: readString(payload, payload._pos, 'utf8'),
          echo: (payload[payload._pos++] !== 0)
        });
      }
      this.emit('USERAUTH_INFO_REQUEST', name, instr, lang, prompts);
    } else
      this.emit('USERAUTH_INFO_REQUEST', name, instr, lang);
  } else if (this._authMethod === 'pubkey') {
    /*
      byte      SSH_MSG_USERAUTH_PK_OK
      string    public key algorithm name from the request
      string    public key blob from the request
    */
    this.emit('USERAUTH_PK_OK');
  }
};

Parser.prototype.parseChRequest = function() {
  var payload = this._payload,
      info;

  var recipient = payload.readUInt32BE(1, true),
      request = readString(payload, 5, 'ascii');
  if (request === 'exit-status') {
    /*
      byte      SSH_MSG_CHANNEL_REQUEST
      uint32    recipient channel
      string    "exit-status"
      boolean   FALSE
      uint32    exit_status
    */
    info = {
      recipient: recipient,
      request: request,
      code: payload.readUInt32BE(1 + payload._pos, true)
    };
    this.emit('CHANNEL_REQUEST:' + recipient, info);
  } else if (request === 'exit-signal') {
    /*
      byte      SSH_MSG_CHANNEL_REQUEST
      uint32    recipient channel
      string    "exit-signal"
      boolean   FALSE
      string    signal name (without the "SIG" prefix)
      boolean   core dumped
      string    error message in ISO-10646 UTF-8 encoding
      string    language tag
    */
    info = {
      recipient: recipient,
      request: request,
      signal: readString(payload, 1 + payload._pos, 'ascii'),
      coredump: (payload[payload._pos] !== 0),
      description: readString(payload, ++payload._pos, 'utf8'),
      lang: readString(payload, payload._pos, 'utf8')
    };
    this.emit('CHANNEL_REQUEST:' + recipient, info);
  }
};

Parser.prototype.parsePacket = function() {
  var payload = this._payload, lang, message, info;

  if (++this._seqno > MAX_SEQNO)
    this._seqno = 0;

  // payload[0] === packet type
  var type = payload[0];

  if (type === MESSAGE.IGNORE) {
    /*
      byte      SSH_MSG_IGNORE
      string    data
    */
  } else if (type === MESSAGE.DISCONNECT) {
    /*
      byte      SSH_MSG_DISCONNECT
      uint32    reason code
      string    description in ISO-10646 UTF-8 encoding
      string    language tag
    */
    var reason = payload.readUInt32BE(1, true),
        description = readString(payload, 5, 'utf8');
    lang = readString(payload, payload._pos, 'ascii');
    this.emit('DISCONNECT', DISCONNECT_REASON[reason],
              reason, description, lang);
  } else if (type === MESSAGE.DEBUG) {
    /*
      byte      SSH_MSG_DEBUG
      boolean   always_display
      string    message in ISO-10646 UTF-8 encoding
      string    language tag
    */
    message = readString(payload, 2, 'utf8');
    lang = readString(payload, payload._pos, 'ascii');
    this.emit('DEBUG', message, lang);
  } else if (type === MESSAGE.KEXINIT)
    this.parseKEXInit();
  else if (type === MESSAGE.KEXDH_REPLY) {
    /*
      byte      SSH_MSG_KEXDH_REPLY
      string    server public host key and certificates (K_S)
      mpint     f
      string    signature of H
    */
    info = {
      hostkey: readString(payload, 1),
      hostkey_format: undefined,
      pubkey: readString(payload, payload._pos),
      sig: readString(payload, payload._pos),
      sig_format: undefined
    };
    info.hostkey_format = readString(info.hostkey, 0, 'ascii');
    info.sig_format = readString(info.sig, 0, 'ascii');
    this.emit('KEXDH_REPLY', info);
  } else if (type === MESSAGE.NEWKEYS) {
      /*
        byte      SSH_MSG_NEW_KEYS
      */
      this.emit('NEWKEYS');
  } else if (type === MESSAGE.SERVICE_ACCEPT) {
      /*
        byte      SSH_MSG_NEW_KEYS
      */
      var serviceName = readString(payload, 1, 'ascii');
      this.emit('SERVICE_ACCEPT', serviceName);
  } else if (type === MESSAGE.USERAUTH_SUCCESS) {
      /*
        byte      SSH_MSG_USERAUTH_SUCCESS
      */
      this.emit('USERAUTH_SUCCESS');
  } else if (type === MESSAGE.USERAUTH_FAILURE) {
      /*
        byte      SSH_MSG_USERAUTH_FAILURE
        name-list    authentications that can continue
        boolean      partial success
      */
      var auths = readString(payload, 1, 'ascii').split(','),
          partSuccess = (payload[payload._pos] !== 0);
      this.emit('USERAUTH_FAILURE', auths, partSuccess);
  } else if (type === MESSAGE.USERAUTH_BANNER) {
      /*
        byte      SSH_MSG_USERAUTH_BANNER
        string    message in ISO-10646 UTF-8 encoding
        string    language tag
      */
      message = readString(payload, 1, 'utf8');
      lang = readString(payload, payload._pos, 'utf8');
      this.emit('USERAUTH_BANNER', message, lang);
  } else if (type === 60) // user auth context-specific messages
      this.parseUserAuthMisc();
  else if (type === MESSAGE.CHANNEL_OPEN) {
      /*
        byte      SSH_MSG_CHANNEL_OPEN
        string    channel type in US-ASCII only
        uint32    sender channel
        uint32    initial window size
        uint32    maximum packet size
        ....      channel type specific data follows
      */
      var chanType = readString(payload, 1, 'ascii');
      if (chanType === 'forwarded-tcpip') {
        /*
          string    address that was connected
          uint32    port that was connected
          string    originator IP address
          uint32    originator port
        */
        var channel = {
          type: chanType,
          sender: payload.readUInt32BE(payload._pos, true),
          window: payload.readUInt32BE(payload._pos += 4, true),
          packetSize: payload.readUInt32BE(payload._pos += 4, true),
          data: {
            destIP: readString(payload, payload._pos += 4, 'ascii'),
            destPort: payload.readUInt32BE(payload._pos, true),
            srcIP: readString(payload, payload._pos += 4, 'ascii'),
            srcPort: payload.readUInt32BE(payload._pos, true)
          }
        };
        this.emit('CHANNEL_OPEN', channel);
      }
  } else if (type === MESSAGE.CHANNEL_OPEN_CONFIRMATION) {
      /*
        byte      SSH_MSG_CHANNEL_OPEN_CONFIRMATION
        uint32    recipient channel
        uint32    sender channel
        uint32    initial window size
        uint32    maximum packet size
        ....      channel type specific data follows
      */
      // "The 'recipient channel' is the channel number given in the
      // original open request, and 'sender channel' is the channel number
      // allocated by the other side."
      info = {
        recipient: payload.readUInt32BE(1, true),
        sender: payload.readUInt32BE(5, true),
        window: payload.readUInt32BE(9, true),
        packetSize: payload.readUInt32BE(13, true),
        data: undefined
      };
      if (payload.length > 17)
        info.data = payload.slice(17);
      this.emit('CHANNEL_OPEN_CONFIRMATION:' + info.recipient, info);
  } else if (type === MESSAGE.CHANNEL_OPEN_FAILURE) {
      /*
        byte      SSH_MSG_CHANNEL_OPEN_FAILURE
        uint32    recipient channel
        uint32    reason code
        string    description in ISO-10646 UTF-8 encoding
        string    language tag
      */
      payload._pos = 9;
      info = {
        recipient: payload.readUInt32BE(1, true),
        reasonCode: payload.readUInt32BE(5, true),
        reason: undefined,
        description: readString(payload, payload._pos, 'utf8'),
        lang: readString(payload, payload._pos, 'utf8')
      };
      info.reason = CHANNEL_OPEN_FAILURE[info.reasonCode];
      this.emit('CHANNEL_OPEN_FAILURE:' + info.recipient, info);
  } else if (type === MESSAGE.CHANNEL_DATA) {
      /*
        byte      SSH_MSG_CHANNEL_DATA
        uint32    recipient channel
        string    data
      */
      this.emit('CHANNEL_DATA:' + payload.readUInt32BE(1, true),
                readString(payload, 5));
  } else if (type === MESSAGE.CHANNEL_EXTENDED_DATA) {
      /*
        byte      SSH_MSG_CHANNEL_EXTENDED_DATA
        uint32    recipient channel
        uint32    data_type_code
        string    data
      */
      this.emit('CHANNEL_EXTENDED_DATA:' + payload.readUInt32BE(1, true),
                payload.readUInt32BE(5, true),
                readString(payload, 9));
  } else if (type === MESSAGE.CHANNEL_WINDOW_ADJUST) {
      /*
        byte      SSH_MSG_CHANNEL_WINDOW_ADJUST
        uint32    recipient channel
        uint32    bytes to add
      */
      this.emit('CHANNEL_WINDOW_ADJUST:' + payload.readUInt32BE(1, true),
                payload.readUInt32BE(5, true));
  } else if (type === MESSAGE.CHANNEL_SUCCESS) {
      /*
        byte      SSH_MSG_CHANNEL_SUCCESS
        uint32    recipient channel
      */
      this.emit('CHANNEL_SUCCESS:' + payload.readUInt32BE(1, true));
  } else if (type === MESSAGE.CHANNEL_FAILURE) {
      /*
        byte      SSH_MSG_CHANNEL_FAILURE
        uint32    recipient channel
      */
      this.emit('CHANNEL_FAILURE:' + payload.readUInt32BE(1, true));
  } else if (type === MESSAGE.CHANNEL_EOF) {
      /*
        byte      SSH_MSG_CHANNEL_EOF
        uint32    recipient channel
      */
      this.emit('CHANNEL_EOF:' + payload.readUInt32BE(1, true));
  } else if (type === MESSAGE.CHANNEL_CLOSE) {
      /*
        byte      SSH_MSG_CHANNEL_CLOSE
        uint32    recipient channel
      */
      this.emit('CHANNEL_CLOSE:' + payload.readUInt32BE(1, true));
  } else if (type === MESSAGE.CHANNEL_REQUEST)
      this.parseChRequest();
  else if (type === MESSAGE.REQUEST_SUCCESS) {
      /*
        byte      SSH_MSG_REQUEST_SUCCESS
        ....      response specific data
      */
      if (payload.length > 1)
        this.emit('REQUEST_SUCCESS', payload.slice(1));
      else
        this.emit('REQUEST_SUCCESS');
  } else if (type === MESSAGE.REQUEST_FAILURE) {
      /*
        byte      SSH_MSG_REQUEST_FAILURE
      */
      this.emit('REQUEST_FAILURE');
  } else if (type === MESSAGE.UNIMPLEMENTED) {
      /*
        byte      SSH_MSG_UNIMPLEMENTED
        uint32    packet sequence number of rejected message
      */
      // TODO
  }
};

Parser.prototype.hmacVerify = function(hmac) {
  var calcHmac = crypto.createHmac(SSH_TO_OPENSSL[this._hmac], this._hmacKey);

  this._hmacBufCompute.writeUInt32BE(this._seqno, 0, true);
  this._hmacBufCompute.writeUInt32BE(this._pktLen, 4, true);
  this._hmacBufCompute[8] = this._padLen;

  calcHmac.update(this._hmacBufCompute);
  calcHmac.update(this._packet);

  return (calcHmac.digest('binary') === hmac.toString('binary'));
};

Parser.prototype.decrypt = function(data) {
  return new Buffer(this._decrypt.update(data, 'binary', 'binary'), 'binary');
};

Parser.prototype.expect = function(type, amount, bufferKey) {
  this._expect = amount;
  this._expectType = type;
  this._expectPtr = 0;
  if (bufferKey && this[bufferKey])
    this._expectBuf = this[bufferKey];
  else if (amount)
    this._expectBuf = new Buffer(amount);
};

Parser.prototype.reset = function() {
  this._state = STATE_INIT;
  this._expect = undefined;
  this._expectType = undefined;
  this._expectPtr = 0;
  this._expectBuf = undefined;

  this._ss = undefined;
  this._greeting = undefined;
  this._decryptSize = 8;
  this._decrypt = false;
  this._decryptBuf = undefined;
  this._authMethod = undefined;

  this._pktLen = undefined;
  this._padLen = undefined;
  this._pktExtra = undefined;
  this._payload = undefined;
  this._hmacBuf = undefined;
  this._hmacSize = undefined;
  this._packet = undefined;
  this._seqno = 0;
  this._kexinit_info = undefined;
  this._kexinit = undefined;
};

function readString(buffer, start, encoding) {
  start || (start = 0);

  var blen = buffer.length, slen;
  if ((blen - start) < 4)
    return false;
  slen = buffer.readUInt32BE(start, true);
  if ((blen - start) < (4 + slen))
    return false;
  buffer._pos = start + 4 + slen;
  if (encoding)
    return buffer.toString(encoding, start + 4, start + 4 + slen);
  else
    return buffer.slice(start + 4, start + 4 + slen);
}

function readList(buffer, start) {
  var list = readString(buffer, start, 'ascii');
  return (list !== false ? (list.length ? list.split(',') : []) : false);
}

Parser.MAX_SEQNO = MAX_SEQNO;
module.exports = Parser;
