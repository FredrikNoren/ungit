'use strict';
const expect = require('expect.js');
const testuser = { username: 'testuser', password: 'testpassword' }
const environment = require('./environment')({
  serverStartupOptions: ['--authentication', '--users.' + testuser.username + '=' + testuser.password],
  showServerOutput: true
});

describe('test authentication', () => {
  before('Environment init', () => environment.init());
  after('Environment stop', () => environment.shutdown());

  it('Open home screen should show authentication dialog', () => {
    return environment.goto(environment.url)
      .wait('.login');
  });

  it('Filling out the authentication with wrong details should result in an error', () => {
    return environment.nightmare
      .insert('.login input[type="text"]', testuser.username)
      .insert('.login input[type="password"]', 'notthepassword')
      .click('.login input[type="submit"]')
      .wait('.login .loginError');
  });

  it('Filling out the authentication should bring you to the home screen', () => {
    return environment.nightmare
      .insert('.login input[type="text"]')
      .insert('.login input[type="text"]', testuser.username)
      .insert('.login input[type="password"]')
      .insert('.login input[type="password"]', testuser.password)
      .click('.login input[type="submit"]')
      .wait('.container.home');
  });
});
