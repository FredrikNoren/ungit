'use strict';
const testuser = { username: 'testuser', password: 'testpassword' }
const environment = require('./environment')({
  serverStartupOptions: ['--authentication', `--users.${testuser.username}=${testuser.password}`],
  showServerOutput: true
});

describe('[AUTHENTICATION]', () => {
  before('Environment init without temp folder', () => environment.init());
  after('Environment stop', () => environment.shutdown());

  it('Open home screen should show authentication dialog', () => {
    return environment.goto(environment.getRootUrl())
      .wait('.login');
  });

  it('Filling out the authentication with wrong details should result in an error', () => {
    return environment.nm.insert('.login #inputUsername', testuser.username)
      .insert('.login #inputPassword', 'notthepassword')
      .click('.login button')
      .wait('.login .loginError');
  });

  it('Filling out the authentication should bring you to the home screen', () => {
    return environment.nm.insert('.login #inputUsername')
      .insert('.login #inputUsername', testuser.username)
      .insert('.login #inputPassword')
      .insert('.login #inputPassword', testuser.password)
      .click('.login button')
      .wait('.container.home');
  });
});
