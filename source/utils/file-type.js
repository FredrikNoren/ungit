// CLIENT SIDE USES this file!
// DO NOT GO ES6!
var path = require('path');
var imageFileExtensions = ['.PNG', '.JPG', '.BMP', '.GIF', '.JPEG'];

module.exports = function(fileName) {
  return imageFileExtensions.indexOf(path.extname(fileName).toUpperCase()) > -1 ? 'image' : 'text';
}
