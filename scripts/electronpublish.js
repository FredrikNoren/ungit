const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const util = require('util');
const rimraf = util.promisify(require('rimraf'));
const archiver = require('archiver');
const baseDir = path.join(__dirname, '..');
const buildDir = path.join(baseDir, 'build');
const distDir = path.join(baseDir, 'dist');

(async () => {
  await rimraf(distDir);
  await mkdirp(distDir);
  const folders = await fs.promises.readdir(buildDir);
  const promises = folders.map((folder) => {
    const source = path.join(buildDir, folder);
    const destination = path.join(distDir, folder + '.zip');
    return zipDirectory(source, destination);
  });
  return Promise.all(promises);
})();

async function zipDirectory(source, destination) {
  const archive = archiver('zip');
  const stream = fs.createWriteStream(destination);

  await new Promise((resolve, reject) => {
    archive
      .directory(source, path.basename(source))
      .on('error', (err) => reject(err))
      .pipe(stream);

    stream.on('close', () => resolve());
    archive.finalize();
  });
  console.log(`zip ${path.relative(baseDir, destination)}`);
}
