const fsSync = require('fs');
const fs = fsSync.promises;
const path = require('path');
const archiver = require('archiver');

const baseDir = path.join(__dirname, '..');
const buildDir = path.join(baseDir, 'build');
const distDir = path.join(baseDir, 'dist');

(async () => {
  let distFolders = [];
  try {
    distFolders = await fs.readdir(distDir);
  } catch (e) {
    await fs.mkdir(distDir);
  }
  for (const oldZip of distFolders) {
    await fs.unlink(path.join(distDir, oldZip));
  }

  const folders = await fs.readdir(buildDir);
  return Promise.all(
    folders.map((folder) => {
      const source = path.join(buildDir, folder);
      const destination = path.join(distDir, `${folder}.zip`);
      return zipDirectory(source, destination);
    })
  );
})();

async function zipDirectory(source, destination) {
  console.log(`start zip ${path.relative(baseDir, destination)}`);
  await new Promise((resolve, reject) => {
    const archive = archiver('zip');
    const stream = fsSync.createWriteStream(destination);

    archive
      .directory(source, path.basename(source))
      .on('error', (err) => reject(err))
      .pipe(stream);

    stream.on('close', () => resolve());
    archive.finalize();
  });
  console.log(`finish zip ${path.relative(baseDir, destination)}`);
}
