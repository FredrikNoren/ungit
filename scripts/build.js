const fsSync = require('fs');
const fs = fsSync.promises;
const path = require('path');

const browserify = require('browserify');
const exorcist = require('exorcist');
const less = require('less');
const mkdirp = require('mkdirp').mkdirp;
const tsify = require('tsify');

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
      } catch {
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
  b.require('winston', { expose: 'winston' });
  const ungitjsFile = path.join(baseDir, 'public/js/ungit.js');
  const mapFile = path.join(baseDir, 'public/js/ungit.js.map');
  await new Promise((resolve) => {
    const outFile = fsSync.createWriteStream(ungitjsFile);
    outFile.on('close', () => resolve());
    b.bundle().pipe(exorcist(mapFile)).pipe(outFile);
  });
  console.log(`browserify ${path.relative(baseDir, ungitjsFile)}`);

  console.log('browserify:components');
  for (const component of components) {
    console.log(`browserify:components:${component}`);
    const sourcePrefix = path.join(baseDir, `components/${component}/${component}`);
    const destination = path.join(baseDir, `components/${component}/${component}.bundle.js`);

    const jsSource = `${sourcePrefix}.js`;
    try {
      await fs.access(jsSource);
      await browserifyFile(jsSource, destination);
    } catch {
      const tsSource = `${sourcePrefix}.ts`;
      try {
        await fs.access(tsSource);
        await browserifyFile(tsSource, destination);
      } catch {
        console.warn(
          `${sourcePrefix} does not exist. If this component is obsolete, please remove that directory or perform a clean build.`
        );
      }
    }
  }

  // copy
  console.log('copy bootstrap fonts');
  await Promise.all(
    [
      'node_modules/bootstrap/fonts/glyphicons-halflings-regular.eot',
      'node_modules/bootstrap/fonts/glyphicons-halflings-regular.svg',
      'node_modules/bootstrap/fonts/glyphicons-halflings-regular.ttf',
      'node_modules/bootstrap/fonts/glyphicons-halflings-regular.woff',
      'node_modules/bootstrap/fonts/glyphicons-halflings-regular.woff2',
    ].map(async (file) => {
      await copyToFolder(file, 'public/fonts');
    })
  );

  console.log('copy raven');
  await Promise.all(
    ['node_modules/raven-js/dist/raven.min.js', 'node_modules/raven-js/dist/raven.min.js.map'].map(
      async (file) => {
        await copyToFolder(file, 'public/js');
      }
    )
  );
})();

async function lessFile(source, destination) {
  const input = await fs.readFile(source, { encoding: 'utf8' });
  const output = await less.render(input, {
    filename: source,
    sourceMap: {
      outputSourceFiles: true,
      sourceMapURL: `${path.basename(destination)}.map`,
    },
  });
  await fs.writeFile(destination, output.css);
  await fs.writeFile(`${destination}.map`, output.map);
  console.log(`less ${path.relative(baseDir, destination)}`);
}

async function browserifyFile(source, destination) {
  const mapDestination = `${destination}.map`;
  await new Promise((resolve) => {
    const b = browserify(source, {
      bundleExternal: false,
      debug: true,
    }).plugin(tsify, {});

    const outFile = fsSync.createWriteStream(destination);
    outFile.on('close', () => resolve());
    b.bundle().pipe(exorcist(mapDestination)).pipe(outFile);
  });
  console.log(`browserify ${path.relative(baseDir, destination)}`);
}
async function copyToFolder(source, destination) {
  source = path.join(baseDir, source);
  destination = path.join(baseDir, destination, path.basename(source));
  await fs.copyFile(source, destination);
  console.log(`copy ${path.relative(baseDir, destination)}`);
}
