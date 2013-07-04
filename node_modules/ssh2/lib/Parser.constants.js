var i = 0, keys, len;

var MESSAGE = exports.MESSAGE = {
  // Transport layer protocol -- generic (1-19)
  DISCONNECT: 1,
  IGNORE: 2,
  UNIMPLEMENTED: 3,
  DEBUG: 4,
  SERVICE_REQUEST: 5,
  SERVICE_ACCEPT: 6,

  // Transport layer protocol -- algorithm negotiation (20-29)
  KEXINIT: 20,
  NEWKEYS: 21,

  // Transport layer protocol -- key exchange method-specific (30-49)
  KEXDH_INIT: 30,
  KEXDH_REPLY: 31,

  // User auth protocol -- generic (50-59)
  USERAUTH_REQUEST: 50,
  USERAUTH_FAILURE: 51,
  USERAUTH_SUCCESS: 52,
  USERAUTH_BANNER: 53,

  // User auth protocol -- user auth method-specific (60-79)

  // Connection protocol -- generic (80-89)
  GLOBAL_REQUEST: 80,
  REQUEST_SUCCESS: 81,
  REQUEST_FAILURE: 82,

  // Connection protocol -- channel-related (90-127)
  CHANNEL_OPEN: 90,
  CHANNEL_OPEN_CONFIRMATION: 91,
  CHANNEL_OPEN_FAILURE: 92,
  CHANNEL_WINDOW_ADJUST: 93,
  CHANNEL_DATA: 94,
  CHANNEL_EXTENDED_DATA: 95,
  CHANNEL_EOF: 96,
  CHANNEL_CLOSE: 97,
  CHANNEL_REQUEST: 98,
  CHANNEL_SUCCESS: 99,
  CHANNEL_FAILURE: 100

  // Reserved for client protocols (128-191)

  // Local extensions (192-155)
};
for (i=0,keys=Object.keys(MESSAGE),len=keys.length; i<len; ++i)
  MESSAGE[MESSAGE[keys[i]]] = keys[i];
// context-specific message codes:
exports.USERAUTH_PASSWD_CHANGEREQ = 60;
exports.USERAUTH_PK_OK = 60;
exports.USERAUTH_INFO_REQUEST = 60;
exports.USERAUTH_INFO_RESPONSE = 61;

var DISCONNECT_REASON = exports.DISCONNECT_REASON = {
  HOST_NOT_ALLOWED_TO_CONNECT: 1,
  PROTOCOL_ERROR: 2,
  KEY_EXCHANGE_FAILED: 3,
  RESERVED: 4,
  MAC_ERROR: 5,
  COMPRESSION_ERROR: 6,
  SERVICE_NOT_AVAILABLE: 7,
  PROTOCOL_VERSION_NOT_SUPPORTED: 8,
  HOST_KEY_NOT_VERIFIABLE: 9,
  CONNECTION_LOST: 10,
  BY_APPLICATION: 11,
  TOO_MANY_CONNECTIONS: 12,
  AUTH_CANCELED_BY_USER: 13,
  NO_MORE_AUTH_METHODS_AVAILABLE: 14,
  ILLEGAL_USER_NAME: 15
};
for (i=0,keys=Object.keys(DISCONNECT_REASON),len=keys.length; i<len; ++i)
  DISCONNECT_REASON[DISCONNECT_REASON[keys[i]]] = keys[i];

var CHANNEL_OPEN_FAILURE = exports.CHANNEL_OPEN_FAILURE = {
  ADMINISTRATIVELY_PROHIBITED: 1,
  CONNECT_FAILED: 2,
  UNKNOWN_CHANNEL_TYPE: 3,
  RESOURCE_SHORTAGE: 4
};
for (i=0,keys=Object.keys(CHANNEL_OPEN_FAILURE),len=keys.length; i<len; ++i)
  CHANNEL_OPEN_FAILURE[CHANNEL_OPEN_FAILURE[keys[i]]] = keys[i];

var TERMINAL_MODE = exports.TERMINAL_MODE = {
  TTY_OP_END: 0,        // Indicates end of options.
  VINTR: 1,             // Interrupt character; 255 if none. Similarly for the
                        //  other characters.  Not all of these characters are
                        //  supported on all systems.
  VQUIT: 2,             // The quit character (sends SIGQUIT signal on POSIX
                        //  systems).
  VERASE: 3,            // Erase the character to left of the cursor.
  VKILL: 4,             // Kill the current input line.
  VEOF: 5,              // End-of-file character (sends EOF from the terminal).
  VEOL: 6,              // End-of-line character in addition to carriage return
                        //  and/or linefeed.
  VEOL2: 7,             // Additional end-of-line character.
  VSTART: 8,            // Continues paused output (normally control-Q).
  VSTOP: 9,             // Pauses output (normally control-S).
  VSUSP: 10,            // Suspends the current program.
  VDSUSP: 11,           // Another suspend character.
  VREPRINT: 12,         // Reprints the current input line.
  VWERASE: 13,          // Erases a word left of cursor.
  VLNEXT: 14,           // Enter the next character typed literally, even if it
                        //  is a special character
  VFLUSH: 15,           // Character to flush output.
  VSWTCH: 16,           // Switch to a different shell layer.
  VSTATUS: 17,          // Prints system status line (load, command, pid, etc).
  VDISCARD: 18,         // Toggles the flushing of terminal output.
  IGNPAR: 30,           // The ignore parity flag.  The parameter SHOULD be 0
                        //  if this flag is FALSE, and 1 if it is TRUE.
  PARMRK: 31,           // Mark parity and framing errors.
  INPCK: 32,            // Enable checking of parity errors.
  ISTRIP: 33,           // Strip 8th bit off characters.
  INLCR: 34,            // Map NL into CR on input.
  IGNCR: 35,            // Ignore CR on input.
  ICRNL: 36,            // Map CR to NL on input.
  IUCLC: 37,            // Translate uppercase characters to lowercase.
  IXON: 38,             // Enable output flow control.
  IXANY: 39,            // Any char will restart after stop.
  IXOFF: 40,            // Enable input flow control.
  IMAXBEL: 41,          // Ring bell on input queue full.
  ISIG: 50,             // Enable signals INTR, QUIT, [D]SUSP.
  ICANON: 51,           // Canonicalize input lines.
  XCASE: 52,            // Enable input and output of uppercase characters by
                        //  preceding their lowercase equivalents with "\".
  ECHO: 53,             // Enable echoing.
  ECHOE: 54,            // Visually erase chars.
  ECHOK: 55,            // Kill character discards current line.
  ECHONL: 56,           // Echo NL even if ECHO is off.
  NOFLSH: 57,           // Don't flush after interrupt.
  TOSTOP: 58,           // Stop background jobs from output.
  IEXTEN: 59,           // Enable extensions.
  ECHOCTL: 60,          // Echo control characters as ^(Char).
  ECHOKE: 61,           // Visual erase for line kill.
  PENDIN: 62,           // Retype pending input.
  OPOST: 70,            // Enable output processing.
  OLCUC: 71,            // Convert lowercase to uppercase.
  ONLCR: 72,            // Map NL to CR-NL.
  OCRNL: 73,            // Translate carriage return to newline (output).
  ONOCR: 74,            // Translate newline to carriage return-newline (output).
  ONLRET: 75,           // Newline performs a carriage return (output).
  CS7: 90,              // 7 bit mode.
  CS8: 91,              // 8 bit mode.
  PARENB: 92,           // Parity enable.
  PARODD: 93,           // Odd parity, else even.
  TTY_OP_ISPEED: 128,   // Specifies the input baud rate in bits per second.
  TTY_OP_OSPEED: 129    // Specifies the output baud rate in bits per second.
};
for (i=0,keys=Object.keys(TERMINAL_MODE),len=keys.length; i<len; ++i)
  TERMINAL_MODE[TERMINAL_MODE[keys[i]]] = keys[i];

var CHANNEL_EXTENDED_DATATYPE = exports.CHANNEL_EXTENDED_DATATYPE = {
  STDERR: 1
};
for (i=0,keys=Object.keys(CHANNEL_EXTENDED_DATATYPE),len=keys.length; i<len; ++i)
  CHANNEL_EXTENDED_DATATYPE[CHANNEL_EXTENDED_DATATYPE[keys[i]]] = keys[i];

var KEX = [
      'diffie-hellman-group14-sha1', // REQUIRED
      'diffie-hellman-group1-sha1' // REQUIRED
    ],
    KEX_LIST = new Buffer(KEX.join(',')),
    SERVER_HOST_KEY = [
      'ssh-rsa', // RECOMMENDED
      'ssh-dss'  // REQUIRED
    ],
    SERVER_HOST_KEY_LIST = new Buffer(SERVER_HOST_KEY.join(',')),
    CIPHER = [
      // from <http://tools.ietf.org/html/rfc4345#section-4>:
      'aes256-cbc',  // OPTIONAL
      'aes192-cbc',  // OPTIONAL
      'aes128-cbc',  // RECOMMENDED

      'blowfish-cbc',// OPTIONAL

      '3des-cbc',    // REQUIRED

      'arcfour256',
      'arcfour128',

      'cast128-cbc', // OPTIONAL

      'arcfour'      // OPTIONAL
      //'none'       // OPTIONAL
    ],
    CIPHER_LIST = new Buffer(CIPHER.join(',')),
    HMAC = [
      'hmac-md5',    // OPTIONAL      (digest length = key length = 16)
      'hmac-sha1',   // REQUIRED      (digest length = key length = 20)
      'hmac-sha2-256',
      'hmac-sha2-256-96',
      'hmac-sha2-512',
      'hmac-sha2-512-96',
      'hmac-ripemd160',
      'hmac-sha1-96',// RECOMMENDED   first 96 bits of HMAC-SHA1
                     //                (digest length = 12, key length = 20)
      'hmac-md5-96'  // OPTIONAL      first 96 bits of HMAC-MD5
                     //                (digest length = 12, key length = 16)
      //'none'       // OPTIONAL
    ],
    HMAC_LIST = new Buffer(HMAC.join(',')),
    COMPRESS = [
      'none'   // REQUIRED
      //'zlib' // OPTIONAL        ZLIB (LZ77) compression
    ],
    COMPRESS_LIST = new Buffer(COMPRESS.join(','));

// ciphers in CTR mode disabled for now
/*if (process.versions.openssl >= '1.0.1') {
  CIPHER = [
    // from <http://tools.ietf.org/html/rfc4344#section-4>:
    'aes128-ctr'  // RECOMMENDED
  ].concat(CIPHER);
}*/

exports.ALGORITHMS = {
  KEX: KEX,
  KEX_LIST: KEX_LIST,
  KEX_LIST_SIZE: KEX_LIST.length,
  SERVER_HOST_KEY: SERVER_HOST_KEY,
  SERVER_HOST_KEY_LIST: SERVER_HOST_KEY_LIST,
  SERVER_HOST_KEY_LIST_SIZE: SERVER_HOST_KEY_LIST.length,
  CIPHER: CIPHER,
  CIPHER_LIST: CIPHER_LIST,
  CIPHER_LIST_SIZE: CIPHER_LIST.length,
  HMAC: HMAC,
  HMAC_LIST: HMAC_LIST,
  HMAC_LIST_SIZE: HMAC_LIST.length,
  COMPRESS: COMPRESS,
  COMPRESS_LIST: COMPRESS_LIST,
  COMPRESS_LIST_SIZE: COMPRESS_LIST.length,
};
exports.SSH_TO_OPENSSL = {
  // ciphers (only counter mode available is for AES and only in OpenSSL 1.0.1+)
  '3des-cbc': 'des-ede3-cbc',
  'blowfish-cbc': 'bf-cbc',
  'aes256-cbc': 'aes-256-cbc',
  'aes192-cbc': 'aes-192-cbc',
  'aes128-cbc': 'aes-128-cbc',
  'idea-cbc': 'idea-cbc',
  'cast128-cbc': 'cast-cbc',
  'rijndael-cbc@lysator.liu.se': 'aes-256-cbc',
  'arcfour128': 'rc4',
  'arcfour256': 'rc4',
  'arcfour512': 'rc4',
  'arcfour': 'rc4',
  'camellia128-cbc': 'camellia-128-cbc',
  'camellia192-cbc': 'camellia-192-cbc',
  'camellia256-cbc': 'camellia-256-cbc',
  'camellia128-cbc@openssh.org': 'camellia-128-cbc',
  'camellia192-cbc@openssh.org': 'camellia-192-cbc',
  'camellia256-cbc@openssh.org': 'camellia-256-cbc',
  /*'3des-ctr': 'des-ede3',
  'blowfish-ctr': 'bf-ecb',
  'aes256-ctr': 'aes-256-ctr',
  'aes192-ctr': 'aes-192-ctr',*/
  'aes128-ctr': 'aes-128-ctr',
  /*'cast128-ctr': 'cast5-ecb',
  'camellia128-ctr': 'camellia-128-ecb',
  'camellia192-ctr': 'camellia-192-ecb',
  'camellia256-ctr': 'camellia-256-ecb',
  'camellia128-ctr@openssh.org': 'camellia-128-ecb',
  'camellia192-ctr@openssh.org': 'camellia-192-ecb',
  'camellia256-ctr@openssh.org': 'camellia-256-ecb',*/
  // hmac
  'hmac-sha1-96': 'sha1',
  'hmac-sha1': 'sha1',
  'hmac-sha2-256': 'sha256',
  'hmac-sha2-256-96': 'sha256',
  'hmac-sha2-512': 'sha512',
  'hmac-sha2-512-96': 'sha512',
  'hmac-md5-96': 'md5',
  'hmac-md5': 'md5',
  'hmac-ripemd160': 'ripemd160'
};