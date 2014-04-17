var fs = require('fs');
var linesPerKBytes = 8;
var kbytes = 1024;
var chars = ['0','1','2','3','4','5','6','7','8','9',
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  'a','b','c','d','e','f','g','h','i','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];

/* 
 *  generate a file with [lines] number of file at the give filepath.
 *  >size: file size, 1 ~= 1kb
 *  >filepath: file path, ("." location is at ~/ungit)
 */ 
var generateTestFile = function(filepath, size) {
  fs.writeFileSync(filepath, getRandomContent(size));
}
exports.generateTestFile = generateTestFile;

/*
  * generate a file where each line is 80 bytes.  (assuming default encoding is UTF-8)
  * >size: file size, 1 ~= 1kb
  */
var getRandomContent = function(size) {
  var file = '';
  var lines = size * linesPerKBytes;

  for(var n = 0; n < lines; n++) {
    file += getRandomString() + '\n';
  }

  return file;
}

// generate a single random [kbytes] / [linesPerKBytes] bytes long string
var getRandomString = function() {
  var str = '';

  for(var n = 0; n < kbytes / linesPerKBytes - 1; n++) {
    str += chars[getRandom()];
  }

  return str;
}

// generate random int
var  getRandom = function() {
  return Math.random() * chars.length | 0;
}