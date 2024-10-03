const process = require('process');
const path = require('path');
const fs = require('fs').promises;
const electronPackager = require('electron-packager');

const baseDir = path.join(__dirname, '..');
const outDir = path.join(baseDir, 'build');

const builds = process.argv.includes('--all') // keep in sync with ci.yml (https://github.com/electron/electron-packager/blob/af334e33c9228493597afcc3931336124d6180c6/src/targets.js#L9-L14)
  ? {
      darwin: ['x64', 'arm64'],
      linux: ['x64', 'armv7l', 'arm64'],
      win32: ['ia32', 'x64', 'arm64'],
    }
  : { current: undefined };

(async () => {
  try {
    await fs.mkdir(outDir);
  } catch (e) {
    if (e.code != 'EEXIST') {
      throw e;
    }
  }

  for (const platform of Object.keys(builds)) {
    await electronPackager({
      dir: baseDir,
      out: outDir,
      icon: path.join(baseDir, 'public/images/icon'),
      platform: platform == 'current' ? undefined : platform,
      arch: builds[platform],
      asar: true,
      overwrite: platform == 'current',
      appCopyright: 'Copyright (c) 2013-2024 Fredrik Norén',
      ignore: [
        /^\/(?:[^/]+?\/)*(?:\..+|.+\.less)$/, // dot-files and less files anywhere
        /^\/(?:\..+|assets|clicktests|coverage|dist|scripts|test)\//, // folders in root
        /^\/[^/]+?\.(?:js|md|png|tgz|yml)$/, // files in root
        /^\/public\/(?:source|vendor)\//, // folders in /public
      ],
    });
  }
})();
