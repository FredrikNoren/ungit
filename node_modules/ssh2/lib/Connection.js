var Socket = require('net').Socket,
    zlib = require('zlib'),
    crypto = require('crypto');

var inherits = require('util').inherits,
    EventEmitter = require('events').EventEmitter,
    inspect = require('util').inspect;

var Parser = require('./Parser'),
    consts = require('./Parser.constants'),
    keyParser = require('./keyParser'),
    Channel = require('./Channel'),
    agentQuery = require('./agent'),
    SFTPv3 = require('./SFTP/SFTPv3');

var MODULE_VER = require('../package.json').version,
    SSH_IDENT = 'SSH-2.0-ssh2js' + MODULE_VER;

var MAX_CHANNEL = Math.pow(2, 32) - 1,
    EMPTY_BUFFER = new Buffer(0),
    ALGORITHMS = consts.ALGORITHMS,
    MESSAGE = consts.MESSAGE,
    SSH_TO_OPENSSL = consts.SSH_TO_OPENSSL,
    DISCONNECT_REASON = consts.DISCONNECT_REASON,
    CHANNEL_OPEN_FAILURE = consts.CHANNEL_OPEN_FAILURE,
    PING_PACKET = new Buffer([MESSAGE.IGNORE, 0, 0, 0, 0]);

function isStreamCipher(cipher) {
  return (cipher.substr(0, 7) === 'arcfour');
}

function Connection(opts) {
  if (!(this instanceof Connection))
    return new Connection(opts);

  var self = this;

  this._host = undefined;
  this._port = undefined;
  this._compress = false;
  this._state = 'closed';

  this._username = undefined;
  this._password = undefined;
  this._privateKey = undefined;
  this._publicKey = undefined;
  this._passphrase = undefined;
  this._tryKeyboard = undefined;
  this._fingerprint = undefined;
  this._cbfingerprint = undefined;
  this._agent = undefined;
  this._debug = undefined;

  this._sock = undefined;
  this._channels = undefined;
  this._callbacks = undefined;
  this._forwarding = undefined;
  this._buffer = undefined;
  this._agentKeys = undefined;
  this._seqno = 0;
  this._bufseqno = new Buffer(4);
  this._encryptSize = 8;
  this._encrypt = false;
  this._hmacKey = undefined;
  this._hmacSize = undefined;
  this._hmac = false;
  this._server_ident_raw = undefined;
  this._kexinit = undefined;
  this._sessionid = undefined;
  this._curChan = -1;

  this._parser = new Parser();

  this._parser.once('header', function(header) {
    if (header.versions.protocol !== '1.99'
        && header.versions.protocol !== '2.0') {
      self._parser.reset();
      return self._sock.destroy();
    }
    self._debug&&self._debug('DEBUG: Connection: Server ident: '
                             + inspect(header.ident_raw));
    self._server_ident_raw = header.ident_raw;
    sendKEXInit();
  });

  //this._parser.on('DEBUG', function(msg, lang) {
  //  self._debug&&self._debug('Server debug: ' +  msg);
  //});

  function sendKEXInit(cb) {
    crypto.randomBytes(16, function(err, my_cookie) {
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
      var kexInitSize = 1 + 16
                        + 4 + ALGORITHMS.KEX_LIST_SIZE
                        + 4 + ALGORITHMS.SERVER_HOST_KEY_LIST_SIZE
                        + (2 * (4 + ALGORITHMS.CIPHER_LIST_SIZE))
                        + (2 * (4 + ALGORITHMS.HMAC_LIST_SIZE))
                        + (2 * (4 + ALGORITHMS.COMPRESS_LIST_SIZE))
                        + (2 * (4 /* languages skipped */))
                        + 1 + 4,
          bufKexInit = new Buffer(kexInitSize),
          p = 17;

      bufKexInit.fill(0);
      bufKexInit[0] = MESSAGE.KEXINIT;

      if (!err)
        my_cookie.copy(bufKexInit, 1);

      bufKexInit.writeUInt32BE(ALGORITHMS.KEX_LIST_SIZE, p, true);
      p += 4;
      ALGORITHMS.KEX_LIST.copy(bufKexInit, p);
      p += ALGORITHMS.KEX_LIST_SIZE;

      bufKexInit.writeUInt32BE(ALGORITHMS.SERVER_HOST_KEY_LIST_SIZE, p, true);
      p += 4;
      ALGORITHMS.SERVER_HOST_KEY_LIST.copy(bufKexInit, p);
      p += ALGORITHMS.SERVER_HOST_KEY_LIST_SIZE;

      bufKexInit.writeUInt32BE(ALGORITHMS.CIPHER_LIST_SIZE, p, true);
      p += 4;
      ALGORITHMS.CIPHER_LIST.copy(bufKexInit, p);
      p += ALGORITHMS.CIPHER_LIST_SIZE;

      bufKexInit.writeUInt32BE(ALGORITHMS.CIPHER_LIST_SIZE, p, true);
      p += 4;
      ALGORITHMS.CIPHER_LIST.copy(bufKexInit, p);
      p += ALGORITHMS.CIPHER_LIST_SIZE;

      bufKexInit.writeUInt32BE(ALGORITHMS.HMAC_LIST_SIZE, p, true);
      p += 4;
      ALGORITHMS.HMAC_LIST.copy(bufKexInit, p);
      p += ALGORITHMS.HMAC_LIST_SIZE;

      bufKexInit.writeUInt32BE(ALGORITHMS.HMAC_LIST_SIZE, p, true);
      p += 4;
      ALGORITHMS.HMAC_LIST.copy(bufKexInit, p);
      p += ALGORITHMS.HMAC_LIST_SIZE;

      bufKexInit.writeUInt32BE(ALGORITHMS.COMPRESS_LIST_SIZE, p, true);
      p += 4;
      ALGORITHMS.COMPRESS_LIST.copy(bufKexInit, p);
      p += ALGORITHMS.COMPRESS_LIST_SIZE;

      bufKexInit.writeUInt32BE(ALGORITHMS.COMPRESS_LIST_SIZE, p, true);
      p += 4;
      ALGORITHMS.COMPRESS_LIST.copy(bufKexInit, p);
      p += ALGORITHMS.COMPRESS_LIST_SIZE;

      // skip language lists, first_kex_packet_follows, and reserved bytes

      self._debug&&self._debug('DEBUG: Connection: Sent KEXINIT');
      self._kexinit = bufKexInit;
      self._send(bufKexInit);
      self.emit('_sentKEXInit');
      cb && cb();
    });
  }

  function checkSKEXInit(init) {
    self._debug&&self._debug('DEBUG: Connection: Comparing KEXInits...');
    // check for agreeable server->client cipher
    for (var i=0,len=ALGORITHMS.CIPHER.length;
         i<len && init.algorithms.sc.encrypt.indexOf(ALGORITHMS.CIPHER[i])
                  === -1;
         ++i);
    if (i === len) {
      // no suitable match found!
      self._parser.reset();
      self._disconnect(DISCONNECT_REASON.KEY_EXCHANGE_FAILED);
      return;
    }

    self._parser._decryptType = ALGORITHMS.CIPHER[i];

    // check for agreeable client->server cipher
    for (i=0,len=ALGORITHMS.CIPHER.length;
         i<len && init.algorithms.cs.encrypt.indexOf(ALGORITHMS.CIPHER[i])
                  === -1;
         ++i);
    if (i === len) {
      // no suitable match found!
      self._parser.reset();
      self._disconnect(DISCONNECT_REASON.KEY_EXCHANGE_FAILED);
      return;
    }

    self._encryptType = ALGORITHMS.CIPHER[i];

    // check for agreeable key exchange algorithm
    for (i=0,len=ALGORITHMS.KEX.length;
         i<len && init.algorithms.kex.indexOf(ALGORITHMS.KEX[i]) === -1;
         ++i);
    if (i === len) {
      // no suitable match found!
      self._parser.reset();
      self._disconnect(DISCONNECT_REASON.KEY_EXCHANGE_FAILED);
      return;
    }

    var kex_algorithm = ALGORITHMS.KEX[i];

    // check for agreeable client->server hmac algorithm
    for (i=0,len=ALGORITHMS.HMAC.length;
         i<len && init.algorithms.cs.mac.indexOf(ALGORITHMS.HMAC[i]) === -1;
         ++i);
    if (i === len) {
      // no suitable match found!
      self._parser.reset();
      self._disconnect(DISCONNECT_REASON.KEY_EXCHANGE_FAILED);
      return;
    }

    self._hmac = ALGORITHMS.HMAC[i];

    // check for agreeable server->client hmac algorithm
    for (i=0,len=ALGORITHMS.HMAC.length;
         i<len && init.algorithms.sc.mac.indexOf(ALGORITHMS.HMAC[i]) === -1;
         ++i);
    if (i === len) {
      // no suitable match found!
      self._parser.reset();
      self._disconnect(DISCONNECT_REASON.KEY_EXCHANGE_FAILED);
      return;
    }

    self._parser._hmac = ALGORITHMS.HMAC[i];

    // check for agreeable client->server compression algorithm
    for (i=0,len=ALGORITHMS.COMPRESS.length;
         i<len && init.algorithms.cs.compress
                                    .indexOf(ALGORITHMS.COMPRESS[i]) === -1;
         ++i);
    if (i === len) {
      // no suitable match found!
      self._parser.reset();
      self._disconnect(DISCONNECT_REASON.KEY_EXCHANGE_FAILED);
      return;
    }

    self._compressType = ALGORITHMS.COMPRESS[i];

    // check for agreeable server->client compression algorithm
    for (i=0,len=ALGORITHMS.COMPRESS.length;
         i<len && init.algorithms.sc.compress
                                    .indexOf(ALGORITHMS.COMPRESS[i]) === -1;
         ++i);
    if (i === len) {
      // no suitable match found!
      self._parser.reset();
      self._disconnect(DISCONNECT_REASON.KEY_EXCHANGE_FAILED);
      return;
    }

    self._parser._compressType = ALGORITHMS.COMPRESS[i];

    // check for agreeable server host key format
    for (i=0,len=ALGORITHMS.SERVER_HOST_KEY.length;
         i<len && init.algorithms.srvHostKey
                      .indexOf(ALGORITHMS.SERVER_HOST_KEY[i]) === -1;
         ++i);
    if (i === len) {
      // no suitable match found!
      self._parser.reset();
      self._disconnect(DISCONNECT_REASON.KEY_EXCHANGE_FAILED);
      return;
    }

    self._hostkey_format = ALGORITHMS.SERVER_HOST_KEY[i];

    if (kex_algorithm === 'diffie-hellman-group1-sha1')
      self._kex = crypto.getDiffieHellman('modp2');
    else if (kex_algorithm === 'diffie-hellman-group14-sha1')
      self._kex = crypto.getDiffieHellman('modp14');

    self._pubkey = new Buffer(self._kex.generateKeys('binary'), 'binary');
    if (self._pubkey[0] & 0x80) {
      var key = new Buffer(self._pubkey.length + 1);
      key[0] = 0;
      self._pubkey.copy(key, 1);
      self._pubkey = key;
    }

    return true;
  }

  function sendKEXDHInit() {
    var bufDHInit = new Buffer(1 + 4 + self._pubkey.length);
    bufDHInit[0] = MESSAGE.KEXDH_INIT;
    bufDHInit.writeUInt32BE(self._pubkey.length, 1, true);
    self._pubkey.copy(bufDHInit, 5);

    self._debug&&self._debug('DEBUG: Connection: Sent KEXDH_INIT');
    self._send(bufDHInit);
  }

  this._parser.on('KEXINIT', function(init) {
    var waitForSend = (self._kexinit === undefined);

    if (self._state === 'authenticated') {
      self._state = 'reexchg';
      self._kexinit = undefined;
      sendKEXInit();
      waitForSend = true;
    }

    if (waitForSend)
      self.once('_sentKEXInit', doCheck);
    else
      doCheck();

    function doCheck() {
      if (checkSKEXInit(init) === true)
        sendKEXDHInit();
    }
  });

  this._parser.on('KEXDH_REPLY', function(info) {
    if (info.hostkey_format !== self._hostkey_format) {
      // expected and actual server host key format do not match!
      self._parser.reset();
      return self._disconnect(DISCONNECT_REASON.KEY_EXCHANGE_FAILED);
    }
    // verify the host fingerprint first if needed
    if (self._state === 'initexchg' && self._fingerprint && self._cbfingerprint) {
      var hostHash = require('crypto').createHash(self._fingerprint);
      hostHash.update(info.hostkey);
      if (!self._cbfingerprint(hostHash.digest('hex'))) {
        self._parser.reset();
        return self._disconnect(DISCONNECT_REASON.KEY_EXCHANGE_FAILED);
      }
    }
    var slicepos = -1;
    for (var i=0,len=info.pubkey.length; i<len; ++i) {
      if (info.pubkey[i] === 0)
        ++slicepos;
      else
        break;
    }
    if (slicepos > -1)
      info.pubkey = info.pubkey.slice(slicepos + 1);
    var compSecret = self._kex.computeSecret(info.pubkey, 'binary', 'binary');
    info.secret = new Buffer(compSecret, 'binary');
    // SHA1 for supported DH group1 and group14 kex methods
    var hash = crypto.createHash('sha1');
    var len_ident = Buffer.byteLength(SSH_IDENT),
        len_sident = Buffer.byteLength(self._server_ident_raw),
        len_init = self._kexinit.length,
        len_sinit = self._parser._kexinit.length,
        len_hostkey = info.hostkey.length,
        len_pubkey = self._pubkey.length,
        len_spubkey = info.pubkey.length,
        len_secret = info.secret.length;
    if (self._pubkey[0] & 0x80)
      ++len_pubkey;
    if (info.pubkey[0] & 0x80)
      ++len_spubkey;
    if (info.secret[0] & 0x80)
      ++len_secret;
    var exchangeBuf = new Buffer(len_ident + len_sident + len_init + len_sinit
                                 + len_hostkey + len_pubkey + len_spubkey
                                 + len_secret + (4 * 8)),
        p = 0;
    exchangeBuf.writeUInt32BE(len_ident, p, true);
    p += 4;
    exchangeBuf.write(SSH_IDENT, p, 'utf8');
    p += len_ident;

    exchangeBuf.writeUInt32BE(len_sident, p, true);
    p += 4;
    exchangeBuf.write(self._server_ident_raw, p, 'utf8');
    p += len_sident;

    exchangeBuf.writeUInt32BE(len_init, p, true);
    p += 4;
    self._kexinit.copy(exchangeBuf, p);
    p += len_init;

    exchangeBuf.writeUInt32BE(len_sinit, p, true);
    p += 4;
    self._parser._kexinit.copy(exchangeBuf, p);
    p += len_sinit;

    exchangeBuf.writeUInt32BE(len_hostkey, p, true);
    p += 4;
    info.hostkey.copy(exchangeBuf, p);
    p += len_hostkey;

    exchangeBuf.writeUInt32BE(len_pubkey, p, true);
    p += 4;
    if (self._pubkey[0] & 0x80)
      exchangeBuf[p++] = 0;
    self._pubkey.copy(exchangeBuf, p);
    p += len_pubkey - (self._pubkey[0] & 0x80 ? 1 : 0);

    exchangeBuf.writeUInt32BE(len_spubkey, p, true);
    p += 4;
    if (info.pubkey[0] & 0x80)
      exchangeBuf[p++] = 0;
    info.pubkey.copy(exchangeBuf, p);
    p += len_spubkey - (info.pubkey[0] & 0x80 ? 1 : 0);

    exchangeBuf.writeUInt32BE(len_secret, p, true);
    p += 4;
    if (info.secret[0] & 0x80)
      exchangeBuf[p++] = 0;
    info.secret.copy(exchangeBuf, p);

    self._exchange_hash = new Buffer(hash.update(exchangeBuf)
                                         .digest('binary'), 'binary');

    if (self._sessionid === undefined)
      self._sessionid = self._exchange_hash;
    self._kexreply = info;
    self._debug&&self._debug('DEBUG: Connection: Sent NEWKEYS');
    self._send(new Buffer([MESSAGE.NEWKEYS]));
  });

  this._parser.on('NEWKEYS', function() {
    var iv, key, blocklen = 8, keylen = 0, p = 0,
        secret, len_secret = (self._kexreply.secret[0] & 0x80 ? 1 : 0)
                             + self._kexreply.secret.length;
    secret = new Buffer(4 + len_secret);
    secret.writeUInt32BE(len_secret, p, true);
    p += 4;
    if (self._kexreply.secret[0] & 0x80)
      secret[p++] = 0;
    self._kexreply.secret.copy(secret, p);
    if (!isStreamCipher(self._encryptType)) {
      iv = new Buffer(crypto.createHash('sha1')
                            .update(secret)
                            .update(self._exchange_hash)
                            .update('A', 'ascii')
                            .update(self._sessionid)
                            .digest('binary'), 'binary');
      switch (self._encryptType) {
        case 'aes256-cbc':
        case 'aes192-cbc':
        case 'aes128-cbc':
        case 'aes256-ctr':
        case 'aes192-ctr':
        case 'aes128-ctr':
          blocklen = 16;
      }
      self._encryptSize = blocklen;
      while (blocklen > iv.length) {
        iv = Buffer.concat([iv, new Buffer(crypto.createHash('sha1')
                                                 .update(secret)
                                                 .update(self._exchange_hash)
                                                 .update(iv)
                                                 .digest('binary'), 'binary')]);
      }
      iv = iv.slice(0, blocklen);
    } else {
      self._encryptSize = blocklen;
      iv = EMPTY_BUFFER; // streaming ciphers don't use an IV upfront
    }
    switch (self._encryptType) {
      case 'aes256-cbc':
      case 'aes256-ctr':
      case 'arcfour256':
        keylen = 32; // eg. 256 / 8
        break;
      case '3des-cbc':
      case '3des-ctr':
      case 'aes192-cbc':
      case 'aes192-ctr':
        keylen = 24; // eg. 192 / 8
        break;
      case 'aes128-cbc':
      case 'aes128-ctr':
      case 'cast128-cbc':
      case 'blowfish-cbc':
      case 'arcfour':
      case 'arcfour128':
        keylen = 16; // eg. 128 / 8
        break;
    }
    key = new Buffer(crypto.createHash('sha1')
                           .update(secret)
                           .update(self._exchange_hash)
                           .update('C', 'ascii')
                           .update(self._sessionid)
                           .digest('binary'), 'binary');
    while (keylen > key.length) {
      key = Buffer.concat([key, new Buffer(crypto.createHash('sha1')
                                                 .update(secret)
                                                 .update(self._exchange_hash)
                                                 .update(key)
                                                 .digest('binary'), 'binary')]);
    }
    key = key.slice(0, keylen);
    self._encrypt = crypto.createCipheriv(SSH_TO_OPENSSL[self._encryptType],
                                          key, iv);
    self._encrypt.setAutoPadding(false);

    // and now for decrypting ...

    blocklen = 8;
    keylen = 0;
    if (!isStreamCipher(self._parser._decryptType)) {
      iv = new Buffer(crypto.createHash('sha1')
                            .update(secret)
                            .update(self._exchange_hash)
                            .update('B', 'ascii')
                            .update(self._sessionid)
                            .digest('binary'), 'binary');
      switch (self._parser._decryptType) {
        case 'aes256-cbc':
        case 'aes192-cbc':
        case 'aes128-cbc':
        case 'aes256-ctr':
        case 'aes192-ctr':
        case 'aes128-ctr':
          blocklen = 16;
      }
      self._parser._decryptSize = blocklen;
      while (blocklen > iv.length) {
        iv = Buffer.concat([iv, new Buffer(crypto.createHash('sha1')
                                                 .update(secret)
                                                 .update(self._exchange_hash)
                                                 .update(iv)
                                                 .digest('binary'), 'binary')]);
      }
      iv = iv.slice(0, blocklen);
    } else {
      self._parser._decryptSize = blocklen;
      iv = EMPTY_BUFFER; // streaming ciphers don't use an IV upfront
    }

    // Create a reusable buffer for decryption purposes
    self._parser._decryptBuf = new Buffer(self._parser._decryptSize);

    switch (self._parser._decryptType) {
      case 'aes256-cbc':
      case 'aes256-ctr':
      case 'arcfour256':
        keylen = 32; // eg. 256 / 8
        break;
      case '3des-cbc':
      case '3des-ctr':
      case 'aes192-cbc':
      case 'aes192-ctr':
        keylen = 24; // eg. 192 / 8
        break;
      case 'aes128-cbc':
      case 'aes128-ctr':
      case 'cast128-cbc':
      case 'blowfish-cbc':
      case 'arcfour':
      case 'arcfour128':
        keylen = 16; // eg. 128 / 8
        break;
    }
    key = new Buffer(crypto.createHash('sha1')
                           .update(secret)
                           .update(self._exchange_hash)
                           .update('D', 'ascii')
                           .update(self._sessionid)
                           .digest('binary'), 'binary');
    while (keylen > key.length) {
      key = Buffer.concat([key, new Buffer(crypto.createHash('sha1')
                                                 .update(secret)
                                                 .update(self._exchange_hash)
                                                 .update(key)
                                                 .digest('binary'), 'binary')]);
    }
    key = key.slice(0, keylen);
    self._parser._decrypt = crypto.createDecipheriv(
                              SSH_TO_OPENSSL[self._parser._decryptType], key, iv
                            );
    self._parser._decrypt.setAutoPadding(false);

    /* The "arcfour128" algorithm is the RC4 cipher, as described in
       [SCHNEIER], using a 128-bit key.  The first 1536 bytes of keystream
       generated by the cipher MUST be discarded, and the first byte of the
       first encrypted packet MUST be encrypted using the 1537th byte of
       keystream.

       -- http://tools.ietf.org/html/rfc4345#section-4 */
    var emptyBuf;
    if (self._encryptType.substr(0, 7) === 'arcfour') {
      emptyBuf = new Buffer(1536);
      emptyBuf.fill(0);
      self._encrypt.update(emptyBuf);
    }
    if (self._parser._decryptType.substr(0, 7) === 'arcfour') {
      emptyBuf = new Buffer(1536);
      emptyBuf.fill(0);
      self._parser._decrypt.update(emptyBuf);
    }

    var createKeyLen = 0, checkKeyLen = 0;
    switch (self._hmac) {
      case 'hmac-sha1':
      case 'hmac-sha1-96':
        createKeyLen = 20;
        break;
      case 'hmac-md5':
      case 'hmac-md5-96':
        createKeyLen = 16;
    }
    switch (self._parser._hmac) {
      case 'hmac-sha1':
        checkKeyLen = 20;
        self._parser._hmacSize = 20;
        break;
      case 'hmac-sha1-96':
        checkKeyLen = 20;
        self._parser._hmacSize = 12;
        break;
      case 'hmac-md5':
        checkKeyLen = 16;
        self._parser._hmacSize = 16;
        break;
      case 'hmac-md5-96':
        checkKeyLen = 16;
        self._parser._hmacSize = 12;
    }
    switch (self._hmac) {
      case 'hmac-sha1':
        self._hmacSize = 20;
        break;
      case 'hmac-md5':
        self._hmacSize = 16;
        break;
      case 'hmac-sha1-96':
      case 'hmac-md5-96':
        self._hmacSize = 12;
    }
    key = new Buffer(crypto.createHash('sha1')
                           .update(secret)
                           .update(self._exchange_hash)
                           .update('E', 'ascii')
                           .update(self._sessionid)
                           .digest('binary'), 'binary');
    while (createKeyLen > key.length) {
      key = Buffer.concat([key, new Buffer(crypto.createHash('sha1')
                                                 .update(secret)
                                                 .update(self._exchange_hash)
                                                 .update(key)
                                                 .digest('binary'), 'binary')]);
    }
    self._hmacKey = key.slice(0, createKeyLen);
    key = new Buffer(crypto.createHash('sha1')
                           .update(secret)
                           .update(self._exchange_hash)
                           .update('F', 'ascii')
                           .update(self._sessionid)
                           .digest('binary'), 'binary');
    while (checkKeyLen > key.length) {
      key = Buffer.concat([key, new Buffer(crypto.createHash('sha1')
                                                 .update(secret)
                                                 .update(self._exchange_hash)
                                                 .update(key)
                                                 .digest('binary'), 'binary')]);
    }
    self._parser._hmacKey = key.slice(0, checkKeyLen);

    // Create a reusable buffer for message verification purposes
    self._parser._hmacBuf = new Buffer(self._parser._hmacSize);

    if (self._compressType !== 'none' && self._compress)
      self._compress = zlib.createDeflate();
    if (self._parser._compressType !== 'none')
      self._parser._compress = zlib.createInflate();

    if (self._state === 'initexchg') {
      // begin to perform user auth
      var svcBuf = new Buffer(1 + 4 + 12);
      svcBuf[0] = MESSAGE.SERVICE_REQUEST;
      svcBuf.writeUInt32BE(12, 1, true);
      svcBuf.write('ssh-userauth', 5, 12, 'ascii');
      self._debug&&self._debug('DEBUG: Connection: Sent SERVICE_REQUEST');
      self._send(svcBuf);
    } else if (self._state === 'reexchg') {
      self._state = 'authenticated';
      // empty our outbound buffer of any data we tried to send while the key
      // re-exchange was happening
      var b = 0, blen = self._buffer.length;
      for (; b < blen; ++b) {
        if (Buffer.isBuffer(self._buffer[b]))
          self._send(self._buffer[b]);
        else
          self._send(self._buffer[b][0], self._buffer[b][1]);
      }
      if (blen) {
        self._buffer = [];
        self.emit('drain');
      }
    }
  });

  this._parser.on('SERVICE_ACCEPT', function(svc) {
    // we previously sent a request to start the process of user authentication
    // and the server is allowing us to continue
    if (svc === 'ssh-userauth') {
      if (self._password)
        self._authPwd();
      else if (self._privateKey && self._publicKey)
        self._authPK(); // do a dry run first to ensure public key is allowed
      else if (self._agent)
        self._authAgent();
    }
  });

  this._parser.on('USERAUTH_SUCCESS', function() {
    // we successfully authenticated with the server
    self._state = 'authenticated';
    if (self._parser._authMethod === 'password'
        && self._parser._newpwd !== undefined) {
      self._password = self._parser._newpwd;
      self._parser._newpwd = undefined;
    }
    if (self._agent && self._agentKeys)
      self._agentKeys = undefined;

    if (typeof self._pingInterval === 'number') {
      self._pinger = setInterval(function() {
        self._ping();
      }, self._pingInterval);
    }
    self.emit('ready');
  });

  this._parser.on('USERAUTH_FAILURE', function(auths, partial) {
    // we failed to authenticate with the server for whatever reason
    if (self._parser._authMethod === 'password'
        && self._parser._newpwd !== undefined) {
      if (partial)
        self._password = self._parser._newpwd;
      self._parser._newpwd = undefined;
    }
    self._auths.methods = auths;
    self._auths.partial = partial;
    self._tryNextAuth();
  });

  this._parser.on('USERAUTH_BANNER', function(message, lang) {
    // the server sent us a notice/banner of some kind for the user to read
    // before attempting to log in, usually a legal notice or some such
    self.emit('banner', message, lang);
  });

  this._parser.on('USERAUTH_PASSWD_CHANGEREQ', function(message, lang) {
    // we tried to authenticate via password, but the server says we need to
    // change our password first
    self._parser._newpwd = undefined;
    self.emit('change password', message, lang, function(newpwd) {
      if (self._sock.writable)
        self._authPwd(newpwd);
      else {
        var err = new Error('Not connected');
        err.level = 'connection-socket';
        self.emit('error', err);
      }
    });
  });

  this._parser.on('USERAUTH_INFO_REQUEST', function(name, inst, lang, prompts) {
    // we sent a keyboard-interactive user authentication request and now the
    // server is sending us the prompts we need to present to the user
    self.emit('keyboard-interactive', name, inst, lang, prompts,
      function(answers) {
        var nprompts = (Array.isArray(prompts) ? prompts.length : 0),
            nanswers = (Array.isArray(answers) ? answers.length : 0);
        if (self._sock.writable) {
          var size = 1 + 4,
              buf, i,
              len = (nprompts < nanswers ? nprompts : nanswers),
              p = 0;
          for (i = 0; i < len; ++i) {
            size += 4;
            size += Buffer.byteLength(answers[i]);
          }
          buf = new Buffer(size);
          buf[p++] = consts.USERAUTH_INFO_RESPONSE;
          buf.writeUInt32BE(len, p, true);
          p += 4;
          for (i = 0; i < len; ++i) {
            size = Buffer.byteLength(answers[i]);
            buf.writeUInt32BE(size, p, true);
            buf.write(answers[i], p += 4, size, 'utf8');
            p += size;
          }
          self._debug&&self._debug('DEBUG: Connection: Sent USERAUTH_INFO_RESPONSE');
          self._send(buf);
        } else {
          var err = new Error('Not connected');
          err.level = 'connection-socket';
          self.emit('error', err);
        }
      }
    );
  });

  this._parser.on('USERAUTH_PK_OK', function() {
    // server says our public key is permitted for user authentication, so
    // continue on with real user authentication request
    // (signing data with private key)
    self._authPK(true);
  });

  this._parser.on('REQUEST_SUCCESS', function(data) {
    // general success response -- one of two replies sent when a packet's
    // "want_reply" is set to true
    if (self._callbacks.length)
      self._callbacks.shift()(false, data);
  });

  this._parser.on('REQUEST_FAILURE', function() {
    // general failure response -- one of two replies sent when a packet's
    // "want_reply" is set to true
    if (self._callbacks.length)
      self._callbacks.shift()(true);
  });

  this._parser.on('CHANNEL_OPEN', function(info) {
    // the server is trying to open a channel with us, this is usually when
    // we asked the server to forward us connections on some port and now they
    // are asking us to accept/deny an incoming connection on their side
    if (info.type === 'forwarded-tcpip') {
      var rejectConn = false, localChan;
      if (self._forwarding.indexOf(info.data.destIP
                                   + ':' + info.data.destPort) === -1)
        rejectConn = true;
      else {
        localChan = self._nextChan();

        if (localChan === false)
          rejectConn = true;
        else
          self._channels.push(localChan);
      }

      // TODO: automatic rejection after some timeout?
      var accept = function() {
        var chaninfo = {
          type: info.type,
          incoming: {
            id: localChan,
            window: Channel.MAX_WINDOW,
            packetSize: Channel.MAX_WINDOW,
            state: 'open'
          },
          outgoing: {
            id: info.sender,
            window: info.window,
            packetSize: info.packetSize,
            state: 'open'
          }
        };
        var stream = new Channel.ChannelStream(new Channel(chaninfo, self));
        stream._channel._stream = stream;
        /*
          byte      SSH_MSG_CHANNEL_OPEN_CONFIRMATION
          uint32    recipient channel
          uint32    sender channel
          uint32    initial window size
          uint32    maximum packet size
        */
        var buf = new Buffer(1 + 4 + 4 + 4 + 4);
        buf[0] = MESSAGE.CHANNEL_OPEN_CONFIRMATION;
        buf.writeUInt32BE(info.sender, 1, true);
        buf.writeUInt32BE(localChan, 5, true);
        buf.writeUInt32BE(Channel.MAX_WINDOW, 9, true);
        buf.writeUInt32BE(Channel.MAX_WINDOW, 13, true);

        self._debug&&self._debug('DEBUG: Connection: Sent CHANNEL_OPEN_CONFIRMATION');
        self._send(buf);

        return stream;
      };
      var reject = function() {
        /*
          byte      SSH_MSG_CHANNEL_OPEN_FAILURE
          uint32    recipient channel
          uint32    reason code
          string    description in ISO-10646 UTF-8 encoding
          string    language tag
        */
        var reason;
        if (localChan === false)
          reason = CHANNEL_OPEN_FAILURE.RESOURCE_SHORTAGE;
        else
          reason = CHANNEL_OPEN_FAILURE.CONNECT_FAILED;
        var buf = new Buffer(1 + 4 + 4 + 4 + 4 + 2);
        buf[0] = MESSAGE.CHANNEL_OPEN_FAILURE;
        buf.writeUInt32BE(info.sender, 1, true);
        buf.writeUInt32BE(reason, 5, true);
        buf.writeUInt32BE(0, 9, true);
        buf.writeUInt32BE(2, 13, true);
        buf.write('en', 17, 2, 'ascii');

        self._debug&&self._debug('DEBUG: Connection: Sent CHANNEL_OPEN_FAILURE');
        self._send(buf);
      };

      if (rejectConn)
        reject();

      if (localChan !== false)
        self.emit('tcp connection', info.data, accept, reject);
    }
  });

  this._parser.once('DISCONNECT', function(reason, reasonCode, desc, lang) {
    var msg = 'Disconnected by host (' + reason + ')', err;
    if (desc.length)
      msg += ': ' + desc;
    err = new Error(msg);
    err.level = 'connection-ssh';
    if (desc.length) {
      err.description = desc;
      err.lang = lang;
    }
    self.emit('error', err);
    self._sock.end();
  });
}
inherits(Connection, EventEmitter);

Connection.prototype.connect = function(opts) {
  var self = this;
  this._host = opts.host || 'localhost';
  this._port = opts.port || 22;
  this._compress = opts.compress || false;
  this._state = 'closed';

  this._username = opts.username;
  this._password = opts.password;
  this._privateKey = opts.privateKey;
  this._publicKey = opts.publicKey;
  this._passphrase = opts.passphrase;
  this._tryKeyboard = opts.tryKeyboard;
  this._fingerprint = opts.hostHash;
  this._cbfingerprint = opts.hostVerifier;
  this._agent = opts.agent; // process.env.SSH_AUTH_SOCK
  this._pingInterval = opts.pingInterval;
  this._debug = (typeof opts.debug === 'function' ? opts.debug : undefined);
  this._parser.debug = this._debug;

  if (this._pingInterval === undefined
      || (typeof this._pingInterval === 'number' && this._pingInterval < 0))
    this._pingInterval = 60000;

  this._sock = (opts.sock ? opts.sock : new Socket());
  this._channels = [];
  this._buffer = [];
  this._callbacks = [];
  this._forwarding = [];
  this._auths = { methods: undefined, partial: undefined };
  this._agentKeys = undefined;
  this._seqno = 0;
  this._encryptSize = 8;
  this._encrypt = false;
  this._hmacKey = undefined;
  this._hmacSize = undefined;
  this._hmac = false;
  this._server_ident_raw = undefined;
  this._kexinit = undefined;
  this._sessionid = undefined;
  this._pinger = undefined;

  this._curChan = -1;
  this._parser.reset();

  if (this._fingerprint !== undefined && this._fingerprint !== 'md5'
      && this._fingerprint !== 'sha1')
    throw new Error("hostHash must be 'sha1' or 'md5'");

  if (this._fingerprint && typeof this._cbfingerprint !== 'function')
    throw new Error('hostVerifier is not a function');

  var keyInfo;
  if (this._privateKey) {
    keyInfo = keyParser(this._privateKey);
    if (!keyInfo)
      throw new Error('Unable to parse given privateKey value');
    if (!keyInfo.private)
      throw new Error('privateKey value does not contain a (valid) private key');
    if (keyInfo.encryption) {
      if (typeof this._passphrase !== 'string')
        throw new Error('Encrypted private key detected, but no passphrase given');
      // perform one-time decryption of private key
      keyInfo.encryption = (SSH_TO_OPENSSL[keyInfo.encryption]
                            || keyInfo.encryption);
      var iv = new Buffer(keyInfo.extra[0], 'hex'),
          key, keylen = 0;
      switch (keyInfo.encryption) {
        case 'aes-256-cbc':
        case 'aes-256-ctr':
          keylen = 32; // eg. 256 / 8
          break;
        case 'des-ede3-cbc':
        case 'des-ede3':
        case 'aes-192-cbc':
        case 'aes-192-ctr':
          keylen = 24; // eg. 192 / 8
          break;
        case 'aes-128-cbc':
        case 'aes-128-ctr':
        case 'cast-cbc':
        case 'bf-cbc':
          keylen = 16; // eg. 128 / 8
          break;
      }
      key = new Buffer(crypto.createHash('md5')
                             .update(this._passphrase
                                     + iv.toString('binary', 0, 8), 'binary')
                             .digest('binary'), 'binary');

      while (keylen > key.length) {
        key = Buffer.concat([
          key,
          new Buffer(crypto.createHash('md5')
                           .update(key.toString('binary')
                                   + this._passphrase
                                   + iv.toString('binary'), 'binary')
                           .digest('binary'), 'binary').slice(0, 8)
        ]);
      }
      if (key.length > keylen)
        key = key.slice(0, keylen);

      var dc = crypto.createDecipheriv(keyInfo.encryption, key, iv),
          out;
      dc.setAutoPadding(false);
      out = dc.update(keyInfo.private, 'binary', 'binary');
      out += dc.final('binary');

      // update our original base64-encoded version of the private key
      var orig = keyInfo.privateOrig.toString('utf8'),
          newOrig = /^(.+(?:\r\n|\n))/.exec(orig)[1],
          b64key = new Buffer(out, 'binary').toString('base64');
      newOrig += b64key.match(/.{1,70}/g).join('\n');
      newOrig += /((?:\r\n|\n).+)$/.exec(orig)[1];

      keyInfo.private = new Buffer(out, 'binary');
      keyInfo.privateOrig = newOrig;
    }

    this._privateKey = keyInfo;
    if (keyInfo.public)
      this._publicKey = keyInfo;
  }
  if (this._privateKey && !this._privateKey.public) {
    // parsing the supplied private key data did not yield a public key
    // (only PuTTY ppk files contain both private and public keys)
    if (this._publicKey) {
      // a public key was explicitly supplied
      keyInfo = keyParser(this._publicKey);
      if (!keyInfo)
        throw new Error('Unable to parse given publicKey value');
      if (!keyInfo.public)
        throw new Error('publicKey value does not contain a (valid) public key');
      if (keyInfo.type !== this._privateKey.type)
        throw new Error('Mismatched private and public key types');
    } else {
      // parsing private key in ASN.1 format in order to generate a public key
      var i = 2, len, octets,
          privKey = this._privateKey.private,
          nStart, nLen, eStart, eLen, // RSA
          pStart, pLen, qStart, qLen, gStart, gLen, yStart, yLen; // DSA

      if (privKey[0] === 0x30) {
        if (privKey[1] & 0x80)
          i += (privKey[1] & 0x7F);

        // version -- integer
        if (privKey[i++] !== 0x02) {
          throw new Error('Unable to parse private key while generating public'
                          + ' key (expected integer for version)');
        }
        len = privKey[i++];
        if (len & 0x80) {
          octets = len & 0x7F;
          len = 0;
          while (octets > 0) {
            len += (privKey[i++] * Math.pow(2, (octets - 1) * 8));
            --octets;
          }
        }
        i += len; // skip version value

        if (this._privateKey.type === 'rsa') {
          // modulus (n) -- integer
          if (privKey[i++] !== 0x02) {
            throw new Error('Unable to parse private key while generating public'
                            + ' key (expected integer for n)');
          }
          nLen = privKey[i++];
          if (nLen & 0x80) {
            octets = nLen & 0x7F;
            nLen = 0;
            while (octets > 0) {
              nLen += (privKey[i++] * Math.pow(2, (octets - 1) * 8));
              --octets;
            }
          }
          nStart = i;
          i += nLen;

          // public exponent (e) -- integer
          if (privKey[i++] !== 0x02) {
            throw new Error('Unable to parse private key while generating public'
                            + ' key (expected integer for e)');
          }
          eLen = privKey[i++];
          if (eLen & 0x80) {
            octets = eLen & 0x7F;
            eLen = 0;
            while (octets > 0) {
              eLen += (privKey[i++] * Math.pow(2, (octets - 1) * 8));
              --octets;
            }
          }
          eStart = i;
        } else { // DSA
          // prime (p) -- integer
          if (privKey[i++] !== 0x02) {
            throw new Error('Unable to parse private key while generating public'
                            + ' key (expected integer for p)');
          }
          pLen = privKey[i++];
          if (pLen & 0x80) {
            octets = pLen & 0x7F;
            pLen = 0;
            while (octets > 0) {
              pLen += (privKey[i++] * Math.pow(2, (octets - 1) * 8));
              --octets;
            }
          }
          pStart = i;
          i += pLen;

          // group order (q) -- integer
          if (privKey[i++] !== 0x02) {
            throw new Error('Unable to parse private key while generating public'
                            + ' key (expected integer for q)');
          }
          qLen = privKey[i++];
          if (qLen & 0x80) {
            octets = qLen & 0x7F;
            qLen = 0;
            while (octets > 0) {
              qLen += (privKey[i++] * Math.pow(2, (octets - 1) * 8));
              --octets;
            }
          }
          qStart = i;
          i += qLen;

          // group generator (g) -- integer
          if (privKey[i++] !== 0x02) {
            throw new Error('Unable to parse private key while generating public'
                            + ' key (expected integer for g)');
          }
          gLen = privKey[i++];
          if (gLen & 0x80) {
            octets = gLen & 0x7F;
            gLen = 0;
            while (octets > 0) {
              gLen += (privKey[i++] * Math.pow(2, (octets - 1) * 8));
              --octets;
            }
          }
          gStart = i;
          i += gLen;

          // public key value (y) -- integer
          if (privKey[i++] !== 0x02) {
            throw new Error('Unable to parse private key while generating public'
                            + ' key (expected integer for g)');
          }
          yLen = privKey[i++];
          if (yLen & 0x80) {
            octets = yLen & 0x7F;
            yLen = 0;
            while (octets > 0) {
              yLen += (privKey[i++] * Math.pow(2, (octets - 1) * 8));
              --octets;
            }
          }
          yStart = i;
          i += yLen;
        }

        var p = 11;
        keyInfo = {
          type: this._privateKey.type,
          public: new Buffer(4 + 7
                             + (this._privateKey.type === 'rsa'
                                ? 4 + nLen + 4 + eLen
                                : 4 + pLen + 4 + qLen + 4 + gLen + 4 + yLen))
        };
        keyInfo.public.writeUInt32BE(7, 0, true);
        keyInfo.public.write('ssh-' + keyInfo.type, 4, 7, 'ascii');
        if (keyInfo.type === 'rsa') {
          keyInfo.public.writeUInt32BE(eLen, p, true);
          privKey.copy(keyInfo.public, p += 4, eStart, eStart + eLen);
          keyInfo.public.writeUInt32BE(nLen, p += eLen, true);
          privKey.copy(keyInfo.public, p += 4, nStart, nStart + nLen);
        } else { // DSA
          keyInfo.public.writeUInt32BE(pLen, p, true);
          privKey.copy(keyInfo.public, p += 4, pStart, pStart + pLen);
          keyInfo.public.writeUInt32BE(qLen, p += pLen, true);
          privKey.copy(keyInfo.public, p += 4, qStart, qStart + qLen);
          keyInfo.public.writeUInt32BE(gLen, p += qLen, true);
          privKey.copy(keyInfo.public, p += 4, gStart, gStart + gLen);
          keyInfo.public.writeUInt32BE(yLen, p += gLen, true);
          privKey.copy(keyInfo.public, p += 4, yStart, yStart + yLen);
        }
      } else
        throw new Error('Unable to parse private key while generating public'
                        + ' key (expected sequence)');
    }
    this._publicKey = keyInfo;
  }

  this._sock.once('connect', function() {
    self._state = 'initexchg';
    self.emit('connect');
    self._sock.write(SSH_IDENT + '\r\n');
  });
  this._sock.on('data', function(data) {
    self._parser.execute(data);
  });
  this._sock.once('error', function(err) {
    err.level = 'connection-socket';
    self.emit('error', err);
  });
  this._sock.once('end', function() {
    if (self._pinger) {
      clearInterval(self._pinger);
      self._pinger = undefined;
    }
    self._state = 'closed';
    self.emit('end');
  });
  this._sock.once('close', function(had_err) {
    if (self._pinger) {
      clearInterval(self._pinger);
      self._pinger = undefined;
    }
    self._parser.reset();
    self._state = 'closed';
    self.emit('close', had_err);
  });
  this._sock.on('drain', function() {
    self.emit('drain');
  });

  if (!opts.sock) {
    this._sock.setNoDelay(true);
    this._sock.setMaxListeners(0);
    this._sock.setTimeout(0);
    this._sock.connect(this._port, this._host);
  }
};

Connection.prototype.exec = function(cmd, opts, cb) {
  // execute an arbitrary command on the server
  if (typeof opts === 'function') {
    cb = opts;
    opts = undefined;
  }

  var self = this;

  return this._openChan('session', function(err, chan) {
    if (err)
      return cb(err);
    if (typeof opts === 'object') {
      if (typeof opts.env === 'object')
        chan._sendEnv(opts.env);
      if (typeof opts.pty === 'object' || opts.pty === true) {
        self._reqPty(chan, opts.pty, function(err) {
          if (err)
            return cb(err);
          chan._sendExec(cmd, cb);
        });
        return;
      }
    }
    chan._sendExec(cmd, cb);
  });
};

Connection.prototype.shell = function(opts, cb) {
  // start an interactive terminal/shell session

  var self = this;

  if (typeof opts === 'function') {
    cb = opts;
    opts = undefined;
  }

  return this._openChan('session', function(err, chan) {
    if (err)
      return cb(err);
    self._reqPty(chan, opts, function(err) {
      if (err)
        return cb(err);
      chan._sendShell(cb);
    });
  });
};

Connection.prototype._reqPty = function(chan, opts, cb) {
  var rows = 24, cols = 80, width = 640, height = 480, term = 'vt100';

  if (typeof opts === 'object') {
    if (typeof opts.rows === 'number')
      rows = opts.rows;
    if (typeof opts.cols === 'number')
      cols = opts.cols;
    if (typeof opts.width === 'number')
      width = opts.width;
    if (typeof opts.height === 'number')
      height = opts.height;
    if (typeof opts.term === 'number')
      term = opts.term;
  } else if (typeof opts === 'function')
    cb = opts;

  chan._sendPtyReq(rows, cols, height, width, term, null, cb);
};

Connection.prototype.forwardIn = function(address, port, cb) {
  // send a request for the server to start forwarding TCP connections to us
  // on a particular address and port
  /*
    byte      SSH_MSG_GLOBAL_REQUEST
    string    "tcpip-forward"
    boolean   want reply
    string    address to bind (e.g., "0.0.0.0")
    uint32    port number to bind
  */
  var self = this,
      addrlen = Buffer.byteLength(address),
      buf = new Buffer(1 + 4 + 13 + 1 + 4 + addrlen + 4);
  buf[0] = MESSAGE.GLOBAL_REQUEST;
  buf.writeUInt32BE(13, 1, true);
  buf.write('tcpip-forward', 5, 13, 'ascii');
  buf[18] = 1;
  buf.writeUInt32BE(addrlen, 19, true);
  buf.write(address, 23, addrlen, 'ascii');
  buf.writeUInt32BE(port, 23 + addrlen, true);

  this._callbacks.push(function(had_err, data) {
    if (had_err)
      return cb(new Error('Unable to bind ' + address + ':' + port));

    if (data && data.length)
      port = data.readUInt32BE(0, true);

    self._forwarding.push(address + ':' + port);

    if (data && data.length) {
      port = data.readUInt32BE(0, true);
      cb(undefined, port);
    } else
      cb();
  });

  this._debug&&this._debug('DEBUG: Connection: Sent GLOBAL_REQUEST (tcpip-forward)');
  return this._send(buf);
};

Connection.prototype.unforwardIn = function(address, port, cb) {
  // send a request to stop forwarding traffic from the server to us for a
  // particular address and port
  /*
    byte      SSH_MSG_GLOBAL_REQUEST
    string    "cancel-tcpip-forward"
    boolean   want reply
    string    address_to_bind (e.g., "127.0.0.1")
    uint32    port number to bind
  */
  var self = this,
      addrlen = Buffer.byteLength(address),
      buf = new Buffer(1 + 4 + 13 + 1 + 4 + addrlen + 4);
  buf[0] = MESSAGE.GLOBAL_REQUEST;
  buf.writeUInt32BE(13, 1, true);
  buf.write('cancel-tcpip-forward', 5, 13, 'ascii');
  buf[18] = 1;
  buf.writeUInt32BE(addrlen, 19, true);
  buf.write(address, 23, addrlen, 'ascii');
  buf.writeUInt32BE(port, 23 + addrlen, true);

  this._callbacks.push(function(had_err) {
    if (had_err)
      return cb(new Error('Unable to unbind ' + address + ':' + port));
    self._forwarding.splice(self._forwarding.indexOf(address + ':' + port), 1);
    cb();
  });

  this._debug&&this._debug('DEBUG: Connection: Sent GLOBAL_REQUEST (cancel-tcpip-forward)');
  return this._send(buf);
};

Connection.prototype.forwardOut = function(srcIP, srcPort, dstIP, dstPort, cb) {
  // send a request to forward a TCP connection to the server
  /*
    byte      SSH_MSG_CHANNEL_OPEN
    string    "direct-tcpip"
    uint32    sender channel
    uint32    initial window size
    uint32    maximum packet size
    -------------------------------
    string    host to connect
    uint32    port to connect
    string    originator IP address
    uint32    originator port
  */
  var srclen = Buffer.byteLength(srcIP),
      dstlen = Buffer.byteLength(dstIP),
      p = 0;
  var buf = new Buffer(4 + srclen + 4 + 4 + dstlen + 4);
  buf.writeUInt32BE(dstlen, p, true);
  buf.write(dstIP, p += 4, dstlen, 'ascii');
  buf.writeUInt32BE(dstPort, p += dstlen, true);
  buf.writeUInt32BE(srclen, p += 4, true);
  buf.write(srcIP, p += 4, srclen, 'ascii');
  buf.writeUInt32BE(srcPort, p += srclen, true);

  return this._openChan('direct-tcpip', buf, function(err, chan) {
    if (err)
      return cb(err);
    var stream = new Channel.ChannelStream(chan);
    chan._stream = stream;
    cb(undefined, stream);
  });
};

Connection.prototype.sftp = function(cb) {
  // start an SFTP session
  return this._openChan('session', function(err, chan) {
    if (err)
      return cb(err);
    chan._sendSubsystem('sftp', function(err, stream) {
      if (err)
        return cb(err);
      var sftp = new SFTPv3(stream);
      sftp._init();
      sftp.once('incompatible', function() {
        sftp.removeAllListeners('ready');
        cb(new Error('SFTP version incompatible'));
      });
      sftp.once('ready', function() {
        sftp.removeAllListeners('incompatible');
        cb(undefined, sftp);
      });
      sftp.once('close', function() {
        stream.end();
      });
    });
  });
};

Connection.prototype.end = function() {
  if (this._sock.writable && this._state === 'authenticated')
    this._disconnect(DISCONNECT_REASON.CONNECTION_LOST);
  else
    this._sock.destroy();
};

Connection.prototype._openChan = function(type, blob, cb) {
  // ask the server to open a channel for some purpose (e.g. session (sftp, exec,
  // terminal), or forwarding a TCP connection to the server)
  var self = this,
      localChan = this._nextChan(),
      inWindow = Channel.MAX_WINDOW,
      inPktSize = Channel.MAX_WINDOW;

  if (localChan === false)
    return cb(new Error('No free channels available'));

  if (typeof blob === 'function') {
    cb = blob;
    blob = undefined;
  }

  this._channels.push(localChan);

  this._parser.once('CHANNEL_OPEN_CONFIRMATION:' + localChan, function(info) {
    // Since EventEmitters do not actually *delete* event names in the
    // emitter's event array, we must do this manually so as not to leak
    // our custom, channel-specific event names.
    delete self._parser._events['CHANNEL_OPEN_CONFIRMATION:' + localChan];
    delete self._parser._events['CHANNEL_OPEN_FAILURE:' + localChan];

    var chaninfo = {
      type: type,
      incoming: {
        id: localChan,
        window: inWindow,
        packetSize: inPktSize,
        state: 'open'
      },
      outgoing: {
        id: info.sender,
        window: info.window,
        packetSize: info.packetSize,
        state: 'open'
      }
    };
    cb(undefined, new Channel(chaninfo, self));
  });
  this._parser.once('CHANNEL_OPEN_FAILURE:' + localChan, function(info) {
    // Since EventEmitters do not actually *delete* event names in the
    // emitter's event array, we must do this manually so as not to leak
    // our custom, channel-specific event names.
    delete self._parser._events['CHANNEL_OPEN_CONFIRMATION:' + localChan];
    delete self._parser._events['CHANNEL_OPEN_FAILURE:' + localChan];

    self._channels.splice(self._channels.indexOf(localChan), 1);
    var err = new Error('(SSH) Channel open failure: ' + info.description);
    err.reason = info.reason;
    err.lang = info.lang;
    cb(err);
  });

  /*
    byte      SSH_MSG_CHANNEL_OPEN
    string    channel type in US-ASCII only
    uint32    sender channel
    uint32    initial window size
    uint32    maximum packet size
    ....      channel type specific data follows
  */
  var typelen = Buffer.byteLength(type),
      bloblen = (blob ? blob.length : 0),
      p = 5 + typelen;
  var buf = new Buffer(1 + 4 + typelen + 4 + 4 + 4 + bloblen);
  buf[0] = MESSAGE.CHANNEL_OPEN;
  buf.writeUInt32BE(typelen, 1, true);
  buf.write(type, 5, typelen, 'ascii');
  buf.writeUInt32BE(localChan, p, true);
  buf.writeUInt32BE(inWindow, p += 4, true);
  buf.writeUInt32BE(inPktSize, p += 4, true);
  if (blob)
    blob.copy(buf, p += 4);

  this._debug&&this._debug('DEBUG: Connection: Sent CHANNEL_OPEN');
  return this._send(buf);
};

Connection.prototype._nextChan = function() {
  // get the next available channel number

  // optimized path
  if (this._curChan < MAX_CHANNEL)
    if (++this._curChan <= MAX_CHANNEL)
      return this._curChan;

  // slower lookup path
  for (var i = 0; i < MAX_CHANNEL; ++i)
    if (this._channels.indexOf(i))
      return i;

  return false;
};

Connection.prototype._ping = function() {
  // simply send an SSH_MSG_IGNORE message for pinging purposes
  this._debug&&this._debug('DEBUG: Connection: Sent ping');
  this._send(PING_PACKET);
};

Connection.prototype._tryNextAuth = function(noAgent) {
  // try the next user authentication mechanism:
  // for ssh-agent users, this means the next public key stored in ssh-agent.
  // otherwise possibly try keyboard-interactive before erroring out
  if (this._agent && !noAgent)
    this._authAgent();
  else if (this._tryKeyboard
           && this._auths.methods.indexOf('keyboard-interactive') > -1
           && this._authMethod !== 'keyboard-interactive')
    this._authKeyboard();
  else {
    var err = new Error('Authentication failure. Available authentication methods: '
                        + this._auths.methods);
    err.level = 'authentication';
    err.partial = this._auths.partial;
    this.emit('error', err);
    this.end();
  }
};

Connection.prototype._authPwd = function(newpwd) {
  // attempt to authenticate via password
  /*
    "Normal" password auth:
      byte      SSH_MSG_USERAUTH_REQUEST
      string    user name
      string    service name
      string    "password"
      boolean   FALSE
      string    plaintext password in ISO-10646 UTF-8 encoding
    "Password change" response
      byte      SSH_MSG_USERAUTH_REQUEST
      string    user name
      string    service name
      string    "password"
      boolean   TRUE
      string    plaintext old password in ISO-10646 UTF-8 encoding
      string    plaintext new password in ISO-10646 UTF-8 encoding
  */
  var userLen = Buffer.byteLength(this._username),
      passLen = Buffer.byteLength(this._password),
      newpwdLen = (newpwd !== undefined ? Buffer.byteLength(newpwd) : 0),
      p = 0,
      buf = new Buffer(1
                       + 4 + userLen
                       + 4 + 14 // "ssh-connection"
                       + 4 + 8 // "password"
                       + 1 // password change response?
                       + 4 + passLen
                       + (newpwd !== undefined
                          ? 4 + newpwdLen
                          : 0)
                      );

  buf[p] = MESSAGE.USERAUTH_REQUEST;
  buf.writeUInt32BE(userLen, ++p, true);
  buf.write(this._username, p += 4, userLen, 'utf8');
  buf.writeUInt32BE(14, p += userLen, true);
  buf.write('ssh-connection', p += 4, 14, 'ascii');
  buf.writeUInt32BE(8, p += 14, true);
  buf.write('password', p += 4, 8, 'ascii');
  buf[p += 8] = (newpwd !== undefined ? 1 : 0);
  buf.writeUInt32BE(passLen, ++p, true);
  buf.write(this._password, p += 4, passLen, 'utf8');
  if (newpwd !== undefined) {
    buf.writeUInt32BE(newpwdLen, p += passLen, true);
    buf.write(newpwd, p += 4, newpwdLen, 'utf8');
    this._parser._newpwd = newpwd;
  }

  this._parser._authMethod = 'password';
  this._debug&&this._debug('DEBUG: Connection: Sent USERAUTH_REQUEST (password)');
  return this._send(buf);
};

Connection.prototype._authKeyboard = function() {
  // attempt to authenticate via keyboard-interactive
  /*
    byte      SSH_MSG_USERAUTH_REQUEST
    string    user name (ISO-10646 UTF-8)
    string    service name (US-ASCII)
    string    "keyboard-interactive" (US-ASCII)
    string    language tag
    string    submethods (ISO-10646 UTF-8)
  */
  var userLen = Buffer.byteLength(this._username),
      p = 0,
      buf = new Buffer(1
                       + 4 + userLen
                       + 4 + 14 // "ssh-connection"
                       + 4 + 20 // "keyboard-interactive"
                       + 4 // no language set
                       + 4 // no submethods
                      );

  buf[p] = MESSAGE.USERAUTH_REQUEST;
  buf.writeUInt32BE(userLen, ++p, true);
  buf.write(this._username, p += 4, userLen, 'utf8');
  buf.writeUInt32BE(14, p += userLen, true);
  buf.write('ssh-connection', p += 4, 14, 'ascii');
  buf.writeUInt32BE(20, p += 14, true);
  buf.write('keyboard-interactive', p += 4, 20, 'ascii');
  buf.writeUInt32BE(0, p += 20, true);
  buf.writeUInt32BE(0, p += 4, true);

  this._parser._authMethod = 'keyboard-interactive';
  this._debug&&this._debug('DEBUG: Connection: Sent USERAUTH_REQUEST (keyboard-interactive)');
  return this._send(buf);
};

Connection.prototype._authPK = function(sign) {
  // attempt to authenticate via key
  this._parser._authMethod = 'pubkey';
  /*
    signature content:
    string    session identifier
    byte      SSH_MSG_USERAUTH_REQUEST
    string    user name
    string    service name
    string    "publickey"
    boolean   TRUE
    string    public key algorithm name
    string    public key to be used for authentication
  */
  var self = this;
  var pubKey, pubKeyType;

  if (this._agent && this._agentKeys) {
    pubKey = this._agentKeys[this._agentKeys.i];
    pubKeyType = this._agentKeys[this._agentKeys.i].toString('ascii', 8, 11);
  } else {
    pubKey = this._publicKey.public;
    pubKeyType = this._publicKey.type;
  }

  var userLen = Buffer.byteLength(this._username),
      algoLen = 7,//4 + Buffer.byteLength(pubKeyType),
      pubKeyLen = pubKey.length,
      sesLen = this._sessionid.length,
      p = 0,
      sig = new Buffer((sign ? 4 + sesLen : 0)
                       + 1
                       + 4 + userLen
                       + 4 + 14 // "ssh-connection"
                       + 4 + 9 // "publickey"
                       + 1
                       + 4 + algoLen
                       + 4 + pubKeyLen
                      );

  if (sign) {
    sig.writeUInt32BE(sesLen, p, true);
    this._sessionid.copy(sig, p += 4);
    sig[p += sesLen] = MESSAGE.USERAUTH_REQUEST;
  } else
    sig[p] = MESSAGE.USERAUTH_REQUEST;
  sig.writeUInt32BE(userLen, ++p, true);
  sig.write(this._username, p += 4, userLen, 'utf8');
  sig.writeUInt32BE(14, p += userLen, true);
  sig.write('ssh-connection', p += 4, 14, 'ascii');
  sig.writeUInt32BE(9, p += 14, true);
  sig.write('publickey', p += 4, 9, 'ascii');
  sig[p += 9] = (sign ? 1 : 0);
  sig.writeUInt32BE(algoLen, ++p, true);
  sig.write('ssh-' + pubKeyType, p += 4, algoLen, 'ascii');
  sig.writeUInt32BE(pubKeyLen, p += algoLen, true);
  pubKey.copy(sig, p += 4);

  if (!sign) {
    this._debug&&this._debug('DEBUG: Connection: Sent USERAUTH_REQUEST (publickey -- check)');
    return this._send(sig);
  }

  var signature, sigLen, privAlgoLen = 7, privAlgo;

  if (this._agent && this._agentKeys) {
    agentQuery(this._agent, pubKey, pubKeyType, sig, function(err, signed) {
      if (err) {
        err.level = 'agent';
        self.emit('error', err);
        self._agentKeys = undefined;
        return self._tryNextAuth();
      }
      privAlgo = pubKeyType;
      if (privAlgo === 'rsa')
        signature = signed.slice(15); // skip algoLen + algo + sigLen
      else
        signature = signed;
      sigLen = signature.length;
      sendSigReq();
    });
    return (this._sock.bufferSize > 0);
  } else {
    var privateKey = this._privateKey.privateOrig;
    privAlgo = this._privateKey.type;

    signature = crypto.createSign(this._privateKey.type === 'rsa'
                                  ? 'RSA-SHA1' : 'DSA-SHA1');
    signature.update(sig);
    signature = new Buffer(signature.sign(privateKey, 'binary'), 'binary');
    sigLen = signature.length;

    if (this._privateKey.type === 'dss' && sigLen > 40) {
      // this is a quick and dirty way to get from DER encoded r and s that
      // OpenSSL gives us, to just the bare values back to back (40 bytes total)
      // like OpenSSH (and possibly others) are expecting
      var newsig = new Buffer(40);
      var rlen = signature[3], rstart = 4, sstart = 4 + 1 + rlen + 1;
      while (signature[rstart] === 0)
        ++rstart;
      while (signature[sstart] === 0)
        ++sstart;
      signature.copy(newsig, 0, rstart, rstart + 20);
      signature.copy(newsig, 20, sstart, sstart + 20);
      signature = newsig;
      sigLen = 40;
    }

    return sendSigReq();
  }

  function sendSigReq() {
    /*
      byte      SSH_MSG_USERAUTH_REQUEST
      string    user name
      string    service name
      string    "publickey"
      boolean   TRUE
      string    public key algorithm name
      string    public key to be used for authentication
      string    signature
    */
    var buf = new Buffer(1
                         + 4 + userLen
                         + 4 + 14 // "ssh-connection"
                         + 4 + 9 // "publickey"
                         + 1
                         + 4 + algoLen
                         + 4 + pubKeyLen
                         + 4 // 4 + privAlgoLen + 4 + sigLen
                         + 4 + privAlgoLen
                         + 4 + sigLen
                        );

    p = 0;
    buf[p] = MESSAGE.USERAUTH_REQUEST;
    buf.writeUInt32BE(userLen, ++p, true);
    buf.write(self._username, p += 4, userLen, 'utf8');
    buf.writeUInt32BE(14, p += userLen, true);
    buf.write('ssh-connection', p += 4, 14, 'ascii');
    buf.writeUInt32BE(9, p += 14, true);
    buf.write('publickey', p += 4, 9, 'ascii');
    buf[p += 9] = 1;
    buf.writeUInt32BE(algoLen, ++p, true);
    buf.write('ssh-' + pubKeyType, p += 4, algoLen, 'ascii');
    buf.writeUInt32BE(pubKeyLen, p += algoLen, true);
    pubKey.copy(buf, p += 4);
    buf.writeUInt32BE(4 + privAlgoLen + 4 + sigLen, p += pubKeyLen, true);
    buf.writeUInt32BE(privAlgoLen, p += 4, true);
    buf.write('ssh-' + privAlgo, p += 4, privAlgoLen, 'ascii');
    buf.writeUInt32BE(sigLen, p += privAlgoLen, true);
    signature.copy(buf, p += 4);

    self._debug&&self._debug('DEBUG: Connection: Sent USERAUTH_REQUEST (publickey)');
    return self._send(buf);
  }
};

Connection.prototype._authAgent = function() {
  // attempt to authenticate via ssh-agent
  this._parser._authMethod = 'agent';

  var self = this, type;
  if (!this._agentKeys) {
    agentQuery(self._agent, function(err, keys) {
      if (err) {
        err.level = 'agent';
        self.emit('error', err);
        self._agentKeys = undefined;
        return self._tryNextAuth(true);
      } else if (keys.length === 0)
        return self._tryNextAuth(true);

      self._agentKeys = keys;
      self._agentKeys.i = 0;

      type = keys[0].toString('ascii', 4, 11);
      if (type !== 'ssh-rsa' && type !== 'ssh-dss')
        return process.nextTick(function() { self._authAgent(); });

      self._authPK();
    });
  } else if (++this._agentKeys.i === this._agentKeys.length)
    this._tryNextAuth(true);
  else {
    type = this._agentKeys[this._agentKeys.i].toString('ascii', 4, 11);
    if (type !== 'ssh-rsa' && type !== 'ssh-dss')
      return process.nextTick(function() { self._authAgent(); });

    this._authPK();
  }
};

Connection.prototype._disconnect = function(reason) {
  /*
    byte      SSH_MSG_DISCONNECT
    uint32    reason code
    string    description in ISO-10646 UTF-8 encoding
    string    language tag
  */
  var buf = new Buffer(1 + 4 + 4 + 4),
      self = this;

  buf.fill(0);
  buf[0] = MESSAGE.DISCONNECT;
  buf.writeUInt32BE(reason, 1, true);

  self._debug&&self._debug('DEBUG: Connection: Sent DISCONNECT');
  return this._send(buf, function() {
    self._sock.end();
  });
};

Connection.prototype._send = function(payload, cb) {
  // TODO: implement length checks, make randomBytes() async again?
  if (this._state === 'reexchg') {
    if (typeof cb === 'function')
      this._buffer.push([payload, cb]);
    else
      this._buffer.push(payload);
    return false;
  } else if (this._state === 'closed' || !this._sock.writable)
    return;

  var pktLen = payload.length + 9,
      padLen,
      buf,
      hmac,
      ret,
      self = this;

  pktLen += ((this._encryptSize - 1) * pktLen) % this._encryptSize;
  padLen = pktLen - payload.length - 5;

  buf = new Buffer(pktLen);

  buf.writeUInt32BE(pktLen - 4, 0, true);
  buf[4] = padLen;
  payload.copy(buf, 5);

  var padBytes = crypto.randomBytes(padLen);
  padBytes.copy(buf, 5 + payload.length);

  if (self._hmac !== false && self._hmacKey) {
    hmac = crypto.createHmac(SSH_TO_OPENSSL[self._hmac], self._hmacKey);
    this._bufseqno.writeUInt32BE(self._seqno, 0, true);
    hmac.update(this._bufseqno);
    hmac.update(buf);
    hmac = hmac.digest('binary');
    if (self._hmac.length > 3 && self._hmac.substr(-3) === '-96') {
      // only keep 96 bits of hash
      hmac = new Buffer(hmac, 'binary').toString('binary', 0, 96 / 8);
    }
    hmac = new Buffer(hmac, 'binary');
  }

  if (self._encrypt !== false) {
    self._sock.write(self._encrypt.update(buf, 'binary', 'binary'), 'binary');
    self._sock.write(hmac);
  } else
    ret = self._sock.write(buf);

  if (++self._seqno > Parser.MAX_SEQNO)
    self._seqno = 0;

  cb&&cb();

  return ret;
};

module.exports = Connection;
