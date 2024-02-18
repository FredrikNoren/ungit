'use strict';
const testuser = { username: 'testuser', password: 'testpassword' };
const environment = require('./environment')({
  serverStartupOptions: ['--authentication', `--users.${testuser.username}=${testuser.password}`],
  showServerOutput: true,
});

describe('[AUTHENTICATION]', () => {
  before('Environment init without temp folder', () => environment.init());

  after('Environment stop', () => environment.shutdown());

  it('Open home screen should show authentication dialog', async function () {
    this.retries(3);
    await environment.goto(environment.getRootUrl());
    await environment.waitForElementVisible('.login');
  });

  it('Filling out the authentication with wrong details should result in an error', async function () {
    this.retries(3);
    await environment.insert('.login #inputUsername', testuser.username);
    await environment.insert('.login #inputPassword', 'notthepassword');
    await environment.click('.login button');
    await environment.waitForElementVisible('.login .loginError');
  });

  it('Filling out the authentication should bring you to the home screen', async function () {
    this.retries(3);
    await environment.insert('.login #inputUsername', testuser.username);
    await environment.insert('.login #inputPassword', testuser.password);
    await environment.click('.login button');
    await environment.waitForElementVisible('.container.home');
  });
});
