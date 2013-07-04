
Description
===========

An SSH2 client module written in pure JavaScript for [node.js](http://nodejs.org/).

Development/testing is done against OpenSSH (6.0 currently).


Requirements
============

* [node.js](http://nodejs.org/) -- v0.8.7 or newer


Install
============

    npm install ssh2


Examples
========

* Authenticate using keys, execute `uptime` on a server, and disconnect afterwards:

```javascript
var Connection = require('ssh2');

var c = new Connection();
c.on('connect', function() {
  console.log('Connection :: connect');
});
c.on('ready', function() {
  console.log('Connection :: ready');
  c.exec('uptime', function(err, stream) {
    if (err) throw err;
    stream.on('data', function(data, extended) {
      console.log((extended === 'stderr' ? 'STDERR: ' : 'STDOUT: ')
                  + data);
    });
    stream.on('end', function() {
      console.log('Stream :: EOF');
    });
    stream.on('close', function() {
      console.log('Stream :: close');
    });
    stream.on('exit', function(code, signal) {
      console.log('Stream :: exit :: code: ' + code + ', signal: ' + signal);
      c.end();
    });
  });
});
c.on('error', function(err) {
  console.log('Connection :: error :: ' + err);
});
c.on('end', function() {
  console.log('Connection :: end');
});
c.on('close', function(had_error) {
  console.log('Connection :: close');
});
c.connect({
  host: '192.168.100.100',
  port: 22,
  username: 'frylock',
  privateKey: require('fs').readFileSync('/here/is/my/key')
});

// example output:
// Connection :: connect
// Connection :: ready
// STDOUT:  17:41:15 up 22 days, 18:09,  1 user,  load average: 0.00, 0.01, 0.05
//
// Stream :: exit :: code: 0, signal: undefined
// Connection :: end
// Connection :: close
```

* Authenticate using password, send a (raw) HTTP request to port 80 on the server, and disconnect afterwards:

```javascript
var Connection = require('ssh2');

var c = new Connection();
c.on('connect', function() {
  console.log('Connection :: connect');
});
c.on('ready', function() {
  console.log('Connection :: ready');
  c.forwardOut('192.168.100.102', 8000, '127.0.0.1', 80, function(err, stream) {
    if (err) throw err;
    stream.on('data', function(data) {
      console.log('TCP :: DATA: ' + data);
    });
    stream.on('end', function() {
      console.log('TCP :: EOF');
    });
    stream.on('error', function(err) {
      console.log('TCP :: ERROR: ' + err);
    });
    stream.on('close', function(had_err) {
      console.log('TCP :: CLOSED');
      c.end();
    });
    var data = [
      'HEAD / HTTP/1.1',
      'User-Agent: curl/7.27.0',
      'Host: 127.0.0.1',
      'Accept: */*',
      'Connection: close',
      '',
      ''
    ];
    stream.write(data.join('\r\n'));
  });
});
c.on('error', function(err) {
  console.log('Connection :: error :: ' + err);
});
c.on('end', function() {
  console.log('Connection :: end');
});
c.on('close', function(had_error) {
  console.log('Connection :: close');
});
c.connect({
  host: '192.168.100.100',
  port: 22,
  username: 'frylock',
  password: 'nodejsrules'
});

// example output:
// Connection :: connect
// Connection :: ready
// TCP :: DATA: HTTP/1.1 200 OK
// Date: Thu, 15 Nov 2012 13:52:58 GMT
// Server: Apache/2.2.22 (Ubuntu)
// X-Powered-By: PHP/5.4.6-1ubuntu1
// Last-Modified: Thu, 01 Jan 1970 00:00:00 GMT
// Content-Encoding: gzip
// Vary: Accept-Encoding
// Connection: close
// Content-Type: text/html; charset=UTF-8
// 
// 
// TCP :: EOF
// TCP :: CLOSED
// Connection :: end
// Connection :: close
```

* Authenticate using password and forward remote connections on port 8000 to us:

```javascript
var Connection = require('ssh2');

var c = new Connection();
c.on('connect', function() {
  console.log('Connection :: connect');
});
c.on('tcp connection', function(info, accept, reject) {
  console.log('TCP :: INCOMING CONNECTION: ' + require('util').inspect(info));

  var stream = accept();

  stream.on('data', function(data) {
    console.log('TCP :: DATA: ' + data);
  });
  stream.on('end', function() {
    console.log('TCP :: EOF');
  });
  stream.on('error', function(err) {
    console.log('TCP :: ERROR: ' + err);
  });
  stream.on('close', function(had_err) {
    console.log('TCP :: CLOSED');
  });
  var response = [
    'HTTP/1.1 404 Not Found',
    'Date: Thu, 15 Nov 2012 02:07:58 GMT',
    'Server: ForwardedConnection',
    'Content-Length: 0',
    'Connection: close',
    '',
    ''
  ];
  stream.end(response.join('\r\n'));
});
c.on('ready', function() {
  console.log('Connection :: ready');
  c.forwardIn('127.0.0.1', 8000, function(err) {
    if (err) throw err;
    console.log('Listening for connections on server on port 8000!');
  });
});
c.on('error', function(err) {
  console.log('Connection :: error :: ' + err);
});
c.on('end', function() {
  console.log('Connection :: end');
});
c.on('close', function(had_error) {
  console.log('Connection :: close');
});
c.connect({
  host: '192.168.100.100',
  port: 22,
  username: 'frylock',
  password: 'nodejsrules'
});

// example output:
// Connection :: connect
// Connection :: ready
// Listening for connections on server on port 8000!
//  (.... then from another terminal on the server: `curl -I http://127.0.0.1:8000`)
// TCP :: INCOMING CONNECTION: { destIP: '127.0.0.1',
//  destPort: 8000,
//  srcIP: '127.0.0.1',
//  srcPort: 41969 }
// TCP DATA: HEAD / HTTP/1.1
// User-Agent: curl/7.27.0
// Host: 127.0.0.1:8000
// Accept: */*
//
//
// TCP :: CLOSED
```

* Authenticate using password, start an SFTP session, and get a directory listing:

```javascript
var Connection = require('ssh2');

var c = new Connection();
c.on('connect', function() {
  console.log('Connection :: connect');
});
c.on('ready', function() {
  console.log('Connection :: ready');
  c.sftp(function(err, sftp) {
    if (err) throw err;
    sftp.on('end', function() {
      console.log('SFTP :: SFTP session closed');
    });
    sftp.opendir('foo', function readdir(err, handle) {
      if (err) throw err;
      sftp.readdir(handle, function(err, list) {
        if (err) throw err;
        if (list === false) {
          sftp.close(handle, function(err) {
            if (err) throw err;
            console.log('SFTP :: Handle closed');
            sftp.end();
          });
          return;
        }
        console.dir(list);
        readdir(undefined, handle);
      });
    });
  });
});
c.on('error', function(err) {
  console.log('Connection :: error :: ' + err);
});
c.on('end', function() {
  console.log('Connection :: end');
});
c.on('close', function(had_error) {
  console.log('Connection :: close');
});
c.connect({
  host: '192.168.100.100',
  port: 22,
  username: 'frylock',
  password: 'nodejsrules'
});

// example output:
// Connection :: connect
// Connection :: ready
// [ { filename: '.',
//     longname: 'drwxr-xr-x    3 mscdex   mscdex       4096 Nov 18 15:03 .',
//     attrs:
//      { size: 1048576,
//        uid: 1000,
//        gid: 1000,
//        mode: 16877,
//        atime: 1353269008,
//        mtime: 1353269007 } },
//   { filename: '..',
//     longname: 'drwxr-xr-x   45 mscdex   mscdex       4096 Nov 18 11:03 ..',
//     attrs:
//      { size: 1048576,
//        uid: 1000,
//        gid: 1000,
//        mode: 16877,
//        atime: 1353254582,
//        mtime: 1353254581 } },
//   { filename: 'test.txt',
//     longname: '-rw-r--r--    1 mscdex   mscdex         12 Nov 18 11:05 test.txt',
//     attrs:
//      { size: 12,
//        uid: 1000,
//        gid: 1000,
//        mode: 33188,
//        atime: 1353254750,
//        mtime: 1353254744 } },
//   { filename: 'mydir',
//     longname: 'drwxr-xr-x    2 mscdex   mscdex       4096 Nov 18 15:03 mydir',
//     attrs:
//      { size: 1048576,
//        uid: 1000,
//        gid: 1000,
//        mode: 16877,
//        atime: 1353269007,
//        mtime: 1353269007 } } ]
// SFTP :: Handle closed
// SFTP :: SFTP session closed
```


API
===

`require('ssh2')` returns a **_Connection_** object

Connection events
-----------------

* **connect**() - A connection to the server was successful.

* **banner**(< _string_ >message, < _string_ >language) - A notice was sent by the server upon connection.

* **ready**() - Authentication was successful.

* **tcp connection**(< _object_ >details, < _function_ >accept, < _function_ >reject) - An incoming forwarded TCP connection is being requested. Calling `accept` accepts the connection and returns a `ChannelStream` object. Calling `reject` rejects the connection and no further action is needed. `details` contains:

    * **srcIP** - _string_ - The originating IP of the connection.

    * **srcPort** - _integer_ - The originating port of the connection.

    * **dstIP** - _string_ - The remote IP the connection was received on (given in earlier call to `forwardIn()`).

    * **dstPort** - _integer_ - The remote port the connection was received on (given in earlier call to `forwardIn()`).

* **keyboard-interactive**(< _string_ >name, < _string_ >instructions, < _string_ >instructionsLang, < _array_ >prompts, < _function_ >finish) - The server is asking for replies to the given `prompts` for keyboard-interactive user authentication. `name` is generally what you'd use as a window title (for GUI apps). `prompts` is an array of `{ prompt: 'Password: ', echo: false }` style objects (here `echo` indicates whether user input should be displayed on the screen). The answers for all prompts must be provided as an array of strings and passed to `finish` when you are ready to continue. Note: It's possible for the server to come back and ask more questions.

* **change password**(< _string_ >message, < _string_ >language, < _function_ >done) - If using password-based user authentication, the server has requested that the user's password be changed. Call `done` with the new password.

* **error**(< _Error_ >err) - An error occurred. A 'level' property indicates 'connection-socket' for socket-level errors and 'connection-ssh' for SSH disconnection messages. In the case of 'connection-ssh' messages, there may be a 'description' property that provides more detail.

* **end**() - The socket was disconnected.

* **close**(< _boolean_ >hadError) - The socket was closed. `hadError` is set to true if this was due to error.


Connection methods
------------------

* **(constructor)**() - Creates and returns a new Connection instance.

* **connect**(< _object_ >config) - _(void)_ - Attempts a connection to a server using the information given in `config`:

    * **host** - < _string_ > - Hostname or IP address of the server. **Default:** 'localhost'

    * **port** - < _integer_ > - Port number of the server. **Default:** 22

    * **hostHash** - < _string_ > - 'md5' or 'sha1'. The host's key is hashed using this method and passed to the **hostVerifier** function. **Default:** (none)

    * **hostVerifier** - < _function_ > - Function that is passed a string hex hash of the host's key for verification purposes. Return true to continue with the connection, false to reject and disconnect. **Default:** (none)

    * **username** - < _string_ > - Username for authentication. **Default:** (none)

    * **password** - < _string_ > - Password for password-based user authentication. **Default:** (none)

    * **agent** - < _string_ > - Path to ssh-agent's UNIX socket for ssh-agent-based user authentication. **Windows users: set to 'pageant' for authenticating with Pageant.** **Default:** (none)

    * **privateKey** - < _mixed_ > - Buffer or string that contains a private key for key-based user authentication (OpenSSH format). **Default:** (none)

    * **passphrase** - < _string_ > - For an encrypted private key, this is the passphrase used to decrypt it. **Default:** (none)
    
    * **publicKey** - < _mixed_ > - Optional Buffer or string that contains a public key for key-based user authentication (OpenSSH format). If `publicKey` is not set, it will be generated from the `privateKey`. **Default:** (none)

    * **tryKeyboard** - < _boolean_ > - Try keyboard-interactive user authentication if primary user authentication method fails. **Default:** false

    * **pingInterval** - < _integer_ > - How often (in milliseconds) to send SSH-level keepalive packets to the server. **Default:** (60000)

    * **sock** - < _ReadableStream_ > - A _ReadableStream_ to use for communicating with the server instead of creating and using a new TCP connection (useful for connection hopping).

**Authentication method priorities:** Password -> Private Key -> Agent (-> keyboard-interactive if `tryKeyboard` is true)

* **exec**(< _string_ >command[, < _object_ >options], < _function_ >callback) - _(void)_ - Executes `command` on the server. Valid `options` properties are:

    * **env** - < _object_ > - An environment to use for the execution of the command.

    * **pty** - < _mixed_ > - Set to true to allocate a pseudo-tty with defaults, or an object containing specific pseudo-tty settings (see 'Pseudo-TTY settings').

    `callback` has 2 parameters: < _Error_ >err, < _ChannelStream_ >stream.

* **shell**([< _object_ >window,] < _function_ >callback) - _(void)_ - Starts an interactive shell session on the server, with optional `window` pseudo-tty settings (see 'Pseudo-TTY settings'). `callback` has 2 parameters: < _Error_ >err, < _ChannelStream_ >stream.

* **forwardIn**(< _string_ >remoteAddr, < _integer_ >remotePort, < _function_ >callback) - _(void)_ - Bind to `remoteAddr` on `remotePort` on the server and forward incoming connections. `callback` has 2 parameters: < _Error_ >err, < _integer_ >port (`port` is the assigned port number if `remotePort` was 0). Here are some special values for `remoteAddr` and their associated binding behaviors:

    * '' - Connections are to be accepted on all protocol families supported by the server.

    * '0.0.0.0' - Listen on all IPv4 addresses.

    * '::' - Listen on all IPv6 addresses.

    * 'localhost' - Listen on all protocol families supported by the server on loopback addresses only.

    * '127.0.0.1' and '::1' - Listen on the loopback interfaces for IPv4 and IPv6, respectively.

* **unforwardIn**(< _string_ >remoteAddr, < _integer_ >remotePort, < _function_ >callback) - _(void)_ - Unbind `remoteAddr` on `remotePort` on the server and stop forwarding incoming connections. Until `callback` is called, more connections may still come in. `callback` has 1 parameter: < _Error_ >err.

* **forwardOut**(< _string_ >srcIP, < _integer_ >srcPort, < _string_ >dstIP, < _integer_ >dstPort, < _function_ >callback) - _(void)_ - Open a connection with `srcIP` and `srcPort` as the originating address and port and `dstIP` and `dstPort` as the remote destination address and port. `callback` has 2 parameters: < _Error_ >err, < _ChannelStream_ >stream.

* **sftp**(< _function_ >callback) - _(void)_ - Starts an SFTP (protocol version 3) session. `callback` has 2 parameters: < _Error_ >err, < _SFTP_ >sftpConnection.

* **end**() - _(void)_ - Disconnects the socket.


ChannelStream
-------------

This is a normal duplex Stream, with the following changes:

* A boolean property 'allowHalfOpen' exists and behaves similarly to the property of the same name for net.Socket. When the stream's end() is called, if 'allowHalfOpen' is true, only EOF will be sent (the server can still send data if they have not already sent EOF). The default value for this property is `false`.

* For shell():

    * **setWindow**(< _integer_ >rows, < _integer_ >cols, < _integer_ >height, < _integer_ >width) - _(void)_ - Lets the server know that the local terminal window has been resized. The meaning of these arguments are described in the 'Pseudo-TTY settings' section.

* For exec():

    * An 'exit' event will be emitted when the process finishes. If the process finished normally, the process's return value is passed to the 'exit' callback. If the process was interrupted by a signal, the following are passed to the 'exit' callback: null, < _string_ >signalName, < _boolean_ >didCoreDump, < _string_ >description.

* For shell() and exec():

    * 'data' events are passed a second (string) argument to the callback, which indicates whether the data is a special type. So far the only defined type is 'stderr'.

    * **signal**(< _string_ >signalName) - _(void)_ - Sends a POSIX signal to the current process on the server. Valid signal names are: 'ABRT', 'ALRM', 'FPE', 'HUP', 'ILL', 'INT', 'KILL', 'PIPE', 'QUIT', 'SEGV', 'TERM', 'USR1', and 'USR2'. Also, from the RFC: "Some systems may not implement signals, in which case they SHOULD ignore this message."


SFTP events
-----------

* **end**() - The SFTP session was ended.


SFTP methods
------------

* **end**() - _(void)_ - Ends the SFTP session.

* **fastGet**(< _string_ >remotePath, < _string_ >localPath[, < _object_ >options], < _function_ >callback) - _(void)_ - Downloads a file at `remotePath` to `localPath` using parallel reads for faster throughput. `options` has the following defaults:

    * concurrency - _integer_ - Number of concurrent reads (default: 25)

    * chunkSize - _integer_ - Size of each read in bytes (default: 32768)

    `callback` has 1 parameter: < _Error_ >err.

* **fastPut**(< _string_ >localPath, < _string_ >remotePath[, < _object_ >options], < _function_ >callback) - _(void)_ - Uploads a file from `localPath` to `remotePath` using parallel reads for faster throughput. `options` has the following defaults:

    * concurrency - _integer_ - Number of concurrent reads (default: 25)

    * chunkSize - _integer_ - Size of each read in bytes (default: 32768)

    `callback` has 1 parameter: < _Error_ >err.

* **createReadStream**(< _string_ >path[, < _object_ >options]) - _ReadStream_ - Returns a new readable stream for `path`. `options` has the following defaults:

    ```javascript
    { flags: 'r',
      encoding: null,
      mode: 0666,
      bufferSize: 64 * 1024
    }
    ```

    `options` can include 'start' and 'end' values to read a range of bytes from the file instead of the entire file. Both 'start' and 'end' are inclusive and start at 0. The encoding can be 'utf8', 'ascii', or 'base64'.

    An example to read the last 10 bytes of a file which is 100 bytes long:

    ```javascript
    sftp.createReadStream('sample.txt', {start: 90, end: 99});
    ```

* **createWriteStream**(< _string_ >path[, < _object_ >options]) - _WriteStream_ - Returns a new writable stream for `path`. `options` has the following defaults:

    ```javascript
    { flags: 'w',
      encoding: null,
      mode: 0666,
      autoClose: true
    }
    ```

    `options` may also include a 'start' option to allow writing data at some position past the beginning of the file. Modifying a file rather than replacing it may require a flags mode of 'r+' rather than the default mode 'w'.

    If 'autoClose' is set to false and you pipe to this stream, this stream will not automatically close after there is no more data upstream -- allowing future pipes and/or manual writes.

* **open**(< _string_ >filename, < _string_ >mode, [< _ATTRS_ >attributes, ]< _function_ >callback) - _(void)_ - Opens a file `filename` for `mode` with optional `attributes`. `mode` is any of the modes supported by fs.open (except sync mode). `callback` has 2 parameters: < _Error_ >err, < _Buffer_ >handle.

* **close**(< _Buffer_ >handle, < _function_ >callback) - _(void)_ - Closes the resource associated with `handle` given by open() or opendir(). `callback` has 1 parameter: < _Error_ >err.

* **read**(< _Buffer_ >handle, < _Buffer_ >buffer, < _integer_ >offset, < _integer_ >length, < _integer_ >position, < _function_ >callback) - _(void)_ - Reads `length` bytes from the resource associated with `handle` starting at `position` and stores the bytes in `buffer` starting at `offset`. `callback` has 4 parameters: < _Error_ >err, < _integer_ >bytesRead, < _Buffer_ >buffer (offset adjusted), < _integer_ >position.

* **write**(< _Buffer_ >handle, < _Buffer_ >buffer, < _integer_ >offset, < _integer_ >length, < _integer_ >position, < _function_ >callback) - _(void)_ - Writes `length` bytes from `buffer` starting at `offset` to the resource associated with `handle` starting at `position`. `callback` has 1 parameter: < _Error_ >err.

* **fstat**(< _Buffer_ >handle, < _function_ >callback) - _(void)_ - Retrieves attributes for the resource associated with `handle`. `callback` has 2 parameters: < _Error_ >err, < _Stats_ >stats.

* **fsetstat**(< _Buffer_ >handle, < _ATTRS_ >attributes, < _function_ >callback) - _(void)_ - Sets the attributes defined in `attributes` for the resource associated with `handle`. `callback` has 1 parameter: < _Error_ >err.

* **futimes**(< _Buffer_ >handle, < _mixed_ >atime, < _mixed_ >mtime, < _function_ >callback) - _(void)_ - Sets the access time and modified time for the resource associated with `handle`. `atime` and `mtime` can be Date instances or UNIX timestamps. `callback` has 1 parameter: < _Error_ >err.

* **fchown**(< _Buffer_ >handle, < _integer_ >uid, < _integer_ >gid, < _function_ >callback) - _(void)_ - Sets the owner for the resource associated with `handle`. `callback` has 1 parameter: < _Error_ >err.

* **fchmod**(< _Buffer_ >handle, < _mixed_ >mode, < _function_ >callback) - _(void)_ - Sets the mode for the resource associated with `handle`. `mode` can be an integer or a string containing an octal number. `callback` has 1 parameter: < _Error_ >err.

* **opendir**(< _string_ >path, < _function_ >callback) - _(void)_ - Opens a directory `path`. `callback` has 2 parameters: < _Error_ >err, < _Buffer_ >handle.

* **readdir**(< _Buffer_ >handle, < _function_ >callback) - _(void)_ - Retrieves directory entries from the directory associated with `handle`. This function may need to be called multiple times to receive the entire directory listing. `callback` has 2 parameters: < _Error_ >err, < _mixed_ >list. `list` is either an _Array_ of `{ filename: 'foo', longname: '....', attrs: {...} }` style objects (attrs is of type _ATTR_) OR boolean false to indicate no more directory entries are available for the given `handle`.

* **unlink**(< _string_ >path, < _function_ >callback) - _(void)_ - Removes the file/symlink at `path`. `callback` has 1 parameter: < _Error_ >err.

* **rename**(< _string_ >srcPath, < _string_ >destPath, < _function_ >callback) - _(void)_ - Renames/moves `srcPath` to `destPath`. `callback` has 1 parameter: < _Error_ >err.

* **mkdir**(< _string_ >path, [< _ATTRS_ >attributes, ]< _function_ >callback) - _(void)_ - Creates a new directory `path`. `callback` has 1 parameter: < _Error_ >err.

* **rmdir**(< _string_ >path, < _function_ >callback) - _(void)_ - Removes the directory at `path`. `callback` has 1 parameter: < _Error_ >err.

* **stat**(< _string_ >path, < _function_ >callback) - _(void)_ - Retrieves attributes for `path`. `callback` has 2 parameter: < _Error_ >err, < _Stats_ >stats.

* **lstat**(< _string_ >path, < _function_ >callback) - _(void)_ - Retrieves attributes for `path`. If `path` is a symlink, the link itself is stat'ed instead of the resource it refers to. `callback` has 2 parameters: < _Error_ >err, < _Stats_ >stats.

* **setstat**(< _string_ >path, < _ATTRS_ >attributes, < _function_ >callback) - _(void)_ - Sets the attributes defined in `attributes` for `path`. `callback` has 1 parameter: < _Error_ >err.

* **utimes**(< _string_ >path, < _mixed_ >atime, < _mixed_ >mtime, < _function_ >callback) - _(void)_ - Sets the access time and modified time for `path`. `atime` and `mtime` can be Date instances or UNIX timestamps. `callback` has 1 parameter: < _Error_ >err.

* **chown**(< _string_ >path, < _integer_ >uid, < _integer_ >gid, < _function_ >callback) - _(void)_ - Sets the owner for `path`. `callback` has 1 parameter: < _Error_ >err.

* **chmod**(< _string_ >path, < _mixed_ >mode, < _function_ >callback) - _(void)_ - Sets the mode for `path`. `mode` can be an integer or a string containing an octal number. `callback` has 1 parameter: < _Error_ >err.

* **readlink**(< _string_ >path, < _function_ >callback) - _(void)_ - Retrieves the target for a symlink at `path`. `callback` has 2 parameters: < _Error_ >err, < _string_ >target.

* **symlink**(< _string_ >targetPath, < _string_ >linkPath, < _function_ >callback) - _(void)_ - Creates a symlink at `linkPath` to `targetPath`. `callback` has 1 parameter: < _Error_ >err.

* **realpath**(< _string_ >path, < _function_ >callback) - _(void)_ - Resolves `path` to an absolute path. `callback` has 2 parameters: < _Error_ >err, < _string_ >absPath.


ATTRS
-----

An object with the following valid properties:

* **mode** - < _integer_ > - Mode/permissions for the resource.

* **uid** - < _integer_ > - User ID of the resource.

* **gid** - < _integer_ > - Group ID of the resource.

* **size** - < _integer_ > - Resource size in bytes.

* **atime** - < _integer_ > - UNIX timestamp of the access time of the resource.

* **mtime** - < _integer_ > - UNIX timestamp of the modified time of the resource.

When supplying an ATTRS object to one of the SFTP methods:

* `atime` and `mtime` can be either a Date instance or a UNIX timestamp.

* `mode` can either be an integer or a string containing an octal number.


Stats
-----

An object with the same attributes as an ATTRS object with the addition of the following methods:

* `stats.isDirectory()`

* `stats.isFile()`

* `stats.isBlockDevice()`

* `stats.isCharacterDevice()`

* `stats.isSymbolicLink()`

* `stats.isFIFO()`

* `stats.isSocket()`


Pseudo-TTY settings
-------------------

* **rows** - < _integer_ > - Number of rows (defaults to 24)

* **cols** - < _integer_ > - Number of columns (defaults to 80)

* **height** - < _integer_ > - Height in pixels (defaults to 480)

* **width** - < _integer_ > - Width in pixels (defaults to 640)

* **term** - < _string_ > - The value to use for $TERM (defaults to 'vt100')

`rows` and `cols` override `width` and `height` when `rows` and `cols` are non-zero.

Pixel dimensions refer to the drawable area of the window.

Zero dimension parameters are ignored.
