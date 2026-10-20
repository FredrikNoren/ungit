'use strict';
const expect = require('expect.js');
const environment = require('./environment')();
const testRepoPaths = [];
const requests = [];

describe('[COMMIT OPTIONS]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [
      { bare: false, initCommits: 1 },
      { bare: true },
      { bare: false, initCommits: 1 },
    ]);
    await environment.openUngit(testRepoPaths[0]);
    environment.page.on('request', (request) => {
      if (request.method() === 'POST' && /\/api\/(commit|push)$/.test(request.url())) {
        requests.push({ url: request.url(), body: JSON.parse(request.postData()) });
      }
    });
  });

  after('Environment stop', () => environment.shutdown());

  it('does not select push options without a remote', async () => {
    await environment.click('.amend-link');
    await environment.click('.commit-grp .dropdown-toggle');
    await environment.click('.commit-skip-hooks-n-push.disabled');
    expect(await environment.page.$eval('.commit-btn', (el) => el.textContent)).to.be('Commit');
    expect(requests).to.have.length(0);
    await environment.click('.btn-stg-cancel');
    await environment.backgroundAction('POST', '/api/remotes/origin', {
      path: testRepoPaths[0],
      url: testRepoPaths[1],
    });
    await environment.page.reload();
    await environment.waitForElementVisible('.repository-actions');
    await environment.page.waitForNetworkIdle();
  });

  for (const option of [
    { selector: '.commit-skip-hooks', label: 'Commit (skip hooks)', skipHooks: true, push: false },
    {
      selector: '.commit-skip-hooks-n-push',
      label: 'Commit (skip hooks) & Push',
      skipHooks: true,
      push: true,
    },
    { selector: '.commitnpush', label: 'Commit & Push', skipHooks: false, push: true },
    { selector: '.commit-only', label: 'Commit', skipHooks: false, push: false },
  ]) {
    it(`selects and retains ${option.label} without executing from the menu`, async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        await environment.createTestFile(
          `${testRepoPaths[0]}/${option.selector}-${attempt}`,
          testRepoPaths[0]
        );
        await environment.waitForElementVisible('.files .file');
        const title = `${option.label} ${attempt}`;
        await environment.insert('.staging input.form-control', title);
        const before = requests.length;
        if (attempt === 0) {
          await environment.click('.commit-grp .dropdown-toggle');
          await environment.click(option.selector);
        }
        await environment.page.waitForNetworkIdle();
        expect(requests.length).to.be(before);
        expect(await environment.page.$eval('.commit-btn', (el) => el.textContent)).to.be(
          option.label
        );
        await environment.click('.commit-btn');
        await environment.waitForElementVisible(
          `[data-ta-node-title="${title}"] .commit-container`
        );
        await environment.page.waitForNetworkIdle();
        const actions = requests.slice(before);
        expect(actions.length).to.be(option.push ? 2 : 1);
        expect(actions[0].url.endsWith('/commit')).to.be(true);
        expect(actions[0].body.skipHooks).to.be(option.skipHooks);
        if (option.push) {
          expect(actions[1].url.endsWith('/push')).to.be(true);
          const log = await environment.backgroundAction('GET', '/api/gitlog', {
            path: testRepoPaths[1],
            limit: 1,
          });
          expect(log.nodes[0].message).to.be(title);
        }
      }
    });
  }

  it('remembers the selected action across reloads and projects without executing it', async () => {
    const before = requests.length;
    await environment.click('.amend-link');
    await environment.click('.commit-grp .dropdown-toggle');
    await environment.click('.commit-skip-hooks-n-push');
    await environment.page.reload();
    await environment.waitForElementVisible('.amend-link');
    await environment.click('.amend-link');
    expect(await environment.page.$eval('.commit-btn', (el) => el.textContent)).to.be(
      'Commit (skip hooks) & Push'
    );

    await environment.openUngit(testRepoPaths[2]);
    await environment.click('.amend-link');
    expect(await environment.page.$eval('.commit-btn', (el) => el.textContent)).to.be(
      'Commit (skip hooks) & Push'
    );
    expect(await environment.page.$eval('.commit-btn', (el) => el.disabled)).to.be(true);
    await environment.click('.commit-grp .dropdown-toggle');
    await environment.click('.commit-skip-hooks');

    await environment.openUngit(testRepoPaths[0]);
    await environment.click('.amend-link');
    expect(await environment.page.$eval('.commit-btn', (el) => el.textContent)).to.be(
      'Commit (skip hooks)'
    );
    await environment.page.waitForNetworkIdle();
    expect(requests.length).to.be(before);
  });

  it('falls back to Commit when the stored action is unknown', async () => {
    await environment.page.evaluate(() => {
      // Runs in the browser, not Node.js.
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      window.localStorage.setItem('selectedCommitAction', 'unknown-action');
    });
    await environment.page.reload();
    await environment.waitForElementVisible('.amend-link');
    await environment.click('.amend-link');
    expect(await environment.page.$eval('.commit-btn', (el) => el.textContent)).to.be('Commit');
  });
});
