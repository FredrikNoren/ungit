const child_process = require('child_process');
const fs = require('fs');

if (
  process.env.TRAVIS_BRANCH != 'master' ||
  (process.env.TRAVIS_PULL_REQUEST && process.env.TRAVIS_PULL_REQUEST != 'false')
) {
  console.log('Skipping travis npm publish');
} else {
  console.log('Preparing travis npm publish');
  child_process.exec('git rev-parse --short HEAD', (err, stdout, stderr) => {
    const hash = stdout.trim();
    const packageJson = JSON.parse(fs.readFileSync('package.json'));
    const version = packageJson.version;
    packageJson.version += `+${hash}`;
    fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
    fs.writeFileSync('.npmrc', '//registry.npmjs.org/:_authToken=' + process.env.NPM_TOKEN);
    console.log(`Publish ${packageJson.version} to npm`);
    child_process.exec('npm publish', (err) => {
      if (err) throw err;
      else {
        console.log(`Create and push tag v${version}`);
        child_process.exec(
          `git tag v${version} && git push -q https://${process.env.GITHUB_TOKEN}@github.com/FredrikNoren/ungit.git v${version}`,
          (err) => {
            if (err) throw err;
          }
        );
      }
    });
  });
}
