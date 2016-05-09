'use strict';

const path = require('path');
const imageFileExtensions = ['.PNG', '.JPG', '.BMP', '.GIF', '.JPEG'];

module.exports = (fileName) => imageFileExtensions.indexOf(path.extname(fileName).toUpperCase()) > -1 ? 'image' : 'text';
