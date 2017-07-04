'use strict';
const testuser = { username: 'testuser', password: 'testpassword' }
const environment = require('./environment')({
  serverStartupOptions: ['--authentication', `--users.${testuser.username}=${testuser.password}`],
  showServerOutput: true
});

describe('[AUTHENTICATION]', () => {
  before('Environment init without temp folder', () => environment.init());
  after('Close nightmare', () => environment.nm.end());

  it('Open home screen should show authentication dialog', () => {
    return environment.goto(environment.getRootUrl())
      .wait('.login');
  });

  it('Filling out the authentication with wrong details should result in an error', () => {
    return environment.nm.insert('.login input[type="text"]', testuser.username)
      .insert('.login input[type="password"]', 'notthepassword')
      .click('.login input[type="submit"]')
      .wait('.login .loginError');
  });

  it('Filling out the authentication should bring you to the home screen', () => {
    return environment.nm.insert('.login input[type="text"]')
      .insert('.login input[type="text"]', testuser.username)
      .insert('.login input[type="password"]')
      .insert('.login input[type="password"]', testuser.password)
      .click('.login input[type="submit"]')
      .wait('.container.home');
  });
});
