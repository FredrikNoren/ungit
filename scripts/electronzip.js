const fsSync = require('fs');
const fs = fsSync.promises;
const path = require('path');
const archiver = require('archiver');

const baseDir = path.join(__dirname, '..');
const buildDir = path.join(baseDir, 'build');
const distDir = path.join(baseDir, 'dist');

(async () => {
  let distFiles = [];
  try {
    distFiles = await fs.readdir(distDir);
  } catch {
    await fs.mkdir(distDir);
  }
  for (const distFile of distFiles) {
    await fs.unlink(path.join(distDir, distFile));
  }

  let buildFolders = [];
  try {
    buildFolders = await fs.readdir(buildDir);
  } catch (e) {
    console.error('Run "npm run electronpackage" before zipping');
    throw e;
  }
  return Promise.all(
    buildFolders.map((folder) => {
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
