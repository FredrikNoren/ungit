const fs = require('fs').promises;
const path = require('path');

module.exports = async ({ github, context, core, exec }) => {
  core.info('Preparing npm publish');
  const hash = context.sha.substring(0, 8);
  const packageJson = JSON.parse(await fs.readFile('package.json', { encoding: 'utf8' }));
  const version = packageJson.version;
  const tag = `v${version}`;
  packageJson.version += `+${hash}`;
  await fs.writeFile('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
  await fs.writeFile('.npmrc', '//registry.npmjs.org/:_authToken=' + process.env.NPM_TOKEN);
  core.info(`Publish ${packageJson.version} to npm`);
  try {
    if ((await exec.exec('npm publish')) != 0) {
      core.info('npm publish failed.');
      return;
    }
  } catch (e) {
    core.info(`npm publish failed: ${e}`);
    return;
  }
  core.info(`Creating release ${tag}`);
  const release = await github.rest.repos.createRelease({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name: tag,
    tag_name: tag,
    body: `[Changelog](https://github.com/FredrikNoren/ungit/blob/master/CHANGELOG.md#${version.replace(
      /\./g,
      ''
    )})`,
  });
  const filePaths = await fs.readdir('dist');
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = path.join('dist', filePaths[i]);
    core.info(`Uploading release asset ${filePath}`);
    await github.rest.repos.uploadReleaseAsset({
      owner: context.repo.owner,
      repo: context.repo.repo,
      release_id: release.data.id,
      name: path.basename(filePath).replace('ungit', `ungit-${version}`),
      data: await fs.readFile(filePath),
    });
  }
};
