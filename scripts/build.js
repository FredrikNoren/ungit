const fsSync = require('fs');
const fs = fsSync.promises;
const path = require('path');

const browserify = require('browserify');
const less = require('less');
const mkdirp = require('mkdirp');

const baseDir = path.join(__dirname, '..');

(async () => {
  await mkdirp(path.join(baseDir, 'public', 'css'));
  await mkdirp(path.join(baseDir, 'public', 'js'));

  const dir = await fs.readdir('components', { withFileTypes: true });
  const components = dir
    .filter((component) => component.isDirectory())
    .map((component) => component.name);

  // less
  console.log('less:common');
  await lessFile(
    path.join(baseDir, 'public/less/styles.less'),
    path.join(baseDir, 'public/css/styles.css')
  );

  console.log('less:components');
  await Promise.all(
    components.map(async (component) => {
      const componentPath = path.join(baseDir, `components/${component}/${component}`);
      try {
        await fs.access(`${componentPath}.less`);
      } catch (e) {
        /* ignore */
        return;
      }
      return lessFile(`${componentPath}.less`, `${componentPath}.css`);
    })
  );

  // browserify
  console.log('browserify:common');
  const publicSourceDir = path.join(baseDir, 'public/source');
  const b = browserify(path.join(baseDir, 'public/source/main.js'), {
    noParse: ['dnd-page-scroll', 'jquery', 'knockout'],
    debug: true,
  });
  b.require(path.join(publicSourceDir, 'components.js'), { expose: 'ungit-components' });
  b.require(path.join(publicSourceDir, 'main.js'), { expose: 'ungit-main' });
  b.require(path.join(publicSourceDir, 'navigation.js'), { expose: 'ungit-navigation' });
  b.require(path.join(publicSourceDir, 'program-events.js'), { expose: 'ungit-program-events' });
  b.require(path.join(publicSourceDir, 'storage.js'), { expose: 'ungit-storage' });
  b.require(path.join(baseDir, 'source/address-parser.js'), { expose: 'ungit-address-parser' });
  b.require('bluebird', { expose: 'bluebird' });
  b.require('blueimp-md5', { expose: 'blueimp-md5' });
  b.require('diff2html', { expose: 'diff2html' });
  b.require('jquery', { expose: 'jquery' });
  b.require('knockout', { expose: 'knockout' });
  b.require('lodash', { expose: 'lodash' });
  b.require(path.join(baseDir, 'node_modules/snapsvg/src/mina.js'), { expose: 'mina' });
  b.require('moment', { expose: 'moment' });
  b.require('@primer/octicons', { expose: 'octicons' });
  b.require('signals', { expose: 'signals' });
  const ungitjsFile = path.join(baseDir, 'public/js/ungit.js');
  await new Promise((resolve) => {
    const outFile = fsSync.createWriteStream(ungitjsFile);
    outFile.on('close', () => resolve());
    b.bundle().pipe(outFile);
  });
  console.log(`browserify ${path.relative(baseDir, ungitjsFile)}`);

  console.log('browserify:components');
  await Promise.all(
    components.map(async (component) => {
      const source = path.join(baseDir, `components/${component}/${component}.js`);
      try {
        await fs.access(source);
      } catch (e) {
        console.warn(
          `${source} does not exist. If this component is obsolete, please remove that directory or perform a clean build.`
        );
        return;
      }
      const destination = path.join(baseDir, `components/${component}/${component}.bundle.js`);
      return browserifyFile(source, destination);
    })
  );

  // copy
  console.log('copy');
  await Promise.all(
    ['node_modules/raven-js/dist/raven.min.js', 'node_modules/raven-js/dist/raven.min.js.map'].map(
      async (file) => {
        const source = path.join(baseDir, file);
        const destination = path.join(baseDir, 'public/js', path.basename(source));
        await fs.copyFile(source, destination);
        console.log(`copy ${path.relative(baseDir, destination)}`);
      }
    )
  );
})();

async function lessFile(source, destination) {
  const input = await fs.readFile(source);
  const output = await less.render(input.toString(), { filename: source });
  await fs.writeFile(destination, output.css);
  console.log(`less ${path.relative(baseDir, destination)}`);
}

async function browserifyFile(source, destination) {
  await new Promise((resolve) => {
    const b = browserify(source, {
      bundleExternal: false,
      debug: true,
    });
    const outFile = fsSync.createWriteStream(destination);
    outFile.on('close', () => resolve());
    b.bundle().pipe(outFile);
  });
  console.log(`browserify ${path.relative(baseDir, destination)}`);
}
