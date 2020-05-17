const process = require('process');
const path = require('path');
const baseDir = path.join(__dirname, '..');

require('electron-packager')({
  dir: baseDir,
  out: path.join(baseDir, 'build'),
  icon: path.join(baseDir, 'public/images/icon'),
  all: process.argv.includes('--all'),
  asar: true,
  overwrite: true,
  ignore: [
    /^\/(?:[^/]+?\/)*(?:\..+|.+\.less)$/, // dot-files and less files anywhere
    /^\/(?:\..+|assets|clicktests|coverage|dist|test)\//, // folders in root
    /^\/[^/]+?\.(?:js|md|png|tgz|yml)$/, // files in root
    /^\/public\/(?:source|vendor)\//, // folders in /public
  ],
});
