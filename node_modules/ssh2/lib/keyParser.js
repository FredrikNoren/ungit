// TODO: handle multi-line header values

var RE_HEADER_PPK = /^PuTTY-User-Key-File-2: ssh-(rsa|dss)$/i,
    RE_HEADER_OPENSSH_PRIV = /^-----BEGIN (RSA|DSA) PRIVATE KEY-----$/i,
    RE_FOOTER_OPENSSH_PRIV = /^-----END (?:RSA|DSA) PRIVATE KEY-----$/i,
    RE_HEADER_OPENSSH_PUB = /^ssh-(rsa|dss) ([A-Z0-9a-z\/+=]+(?:$|\s+([\S].*)?)$)/i,
    RE_HEADER_RFC4176_PUB = /^---- BEGIN SSH2 PUBLIC KEY ----$/i,
    RE_FOOTER_RFC4176_PUB = /^---- END SSH2 PUBLIC KEY ----$/i,
    RE_HEADER = /^([^:]+):\s*([\S].*)?$/i;

module.exports = function(data) {
  if (Buffer.isBuffer(data))
    data = data.toString('utf8');
  else if (typeof data !== 'string')
    return false;

  var ret = {
    type: undefined,
    extra: undefined,
    comment: undefined,
    encryption: undefined,
    private: undefined,
    privateOrig: undefined,
    public: undefined,
    publicOrig: undefined
  }, m, i, len;

  data = data.split(/\r\n|\n/);
  while (!data[0].length)
    data.shift();
  while (!data[data.length - 1].length)
    data.pop();

  var orig = data.join('\n');

  /*if (m = RE_HEADER_PPK.exec(data[0])) {
    // PuTTY private and/or public key(s)
    var nlines, j;
    ret.type = m[1].toLowerCase();
    for (i = 1, len = data.length; i < len; ++i) {
      m = RE_HEADER.exec(data[i]);
      m[1] = m[1].toLowerCase();
      if (m[1] === 'encryption' && m[2].toLowerCase() !== 'none')
        ret.encryption = m[2];
      else if (m[1] === 'comment' && m[2])
        ret.comment = m[2];
      else if (m[1] === 'public-lines') {
        nlines = parseInt(m[2], 10);
        if (nlines > 1) {
          ret.public = new Buffer(data.slice(i + 1, i + 1 + nlines).join(''),
                                  'base64');
        } else
          ret.public = new Buffer(data[i + 1], 'base64');
        i += nlines;
      } else if (m[1] === 'private-lines') {
        nlines = parseInt(m[2], 10);
        if (nlines > 1) {
          ret.private = new Buffer(data.slice(i + 1, i + 1 + nlines).join(''),
                                  'base64');
        } else
          ret.private = new Buffer(data[i + 1], 'base64');
        i += nlines;
      }
    }
  } else*/ if ((m = RE_HEADER_OPENSSH_PRIV.exec(data[0]))
             && RE_FOOTER_OPENSSH_PRIV.test(data[data.length - 1])) {
    // OpenSSH private key
    ret.type = (m[1].toLowerCase() === 'dsa' ? 'dss' : 'rsa');
    if (!RE_HEADER.test(data[1])) {
      // unencrypted, no headers
      ret.private = new Buffer(data.slice(1, data.length - 1).join(''), 'base64');
    } else {
      // possibly encrypted, headers
      for (i = 1, len = data.length; i < len; ++i) {
        m = RE_HEADER.exec(data[i]);
        if (m) {
          m[1] = m[1].toLowerCase();
          if (m[1] === 'dek-info') {
            m[2] = m[2].split(',');
            ret.encryption = m[2][0].toLowerCase();
            if (m[2].length > 1)
              ret.extra = m[2].slice(1);
          }
        } else if (data[i].length)
          break;
      }
      ret.private = new Buffer(data.slice(i, data.length - 1).join(''), 'base64');
    }
    ret.privateOrig = new Buffer(orig);
  } else if (m = RE_HEADER_OPENSSH_PUB.exec(data[0])) {
    // OpenSSH public key
    ret.type = m[1].toLowerCase();
    ret.public = new Buffer(m[2], 'base64');
    ret.publicOrig = new Buffer(orig);
    ret.comment = m[3];
  } else if ((m = RE_HEADER_RFC4176_PUB.exec(data[0]))
             && RE_FOOTER_RFC4176_PUB.test(data[data.length - 1])) {
    if (!RE_HEADER.test(data[1])) {
      // no headers
      ret.public = new Buffer(data.slice(1, data.length - 1).join(''), 'base64');
    } else {
      // headers
      for (i = 1, len = data.length; i < len; ++i) {
        m = RE_HEADER.exec(data[i]);
        if (m) {
          m[1] = m[1].toLowerCase();
          if (m[1] === 'dek-info') {
            m[2] = m[2].split(',');
            ret.encryption = m[2][0].toLowerCase();
            if (m[2].length > 1)
              ret.extra = m[2].slice(1);
          } else if (m[1] === 'comment')
            ret.comment = m[2];
        } else if (data[i].length)
          break;
      }
      ret.public = new Buffer(data.slice(i, data.length - 1).join(''), 'base64');
    }
    len = ret.public.readUInt32BE(0, true);
    if (len !== 7)
      return false;
    else {
      var type = ret.public.toString('ascii', 4, 11);
      if (type === 'ssh-dss')
        ret.type = 'dss';
      else if (type === 'ssh-rsa')
        ret.type = 'rsa';
      else
        return false;
    }
    ret.public = ret.public.slice(11);
    ret.publicOrig = new Buffer(orig);
  } else
    return false;

  return ret;
};