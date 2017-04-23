const expect = require('expect.js');
const testuser = { username: 'testuser', password: 'testpassword' }
const environment = require('./environment')({
  serverStartupOptions: ['--authentication', '--users.' + testuser.username + '=' + testuser.password],
  showServerOutput: true
});

describe('test authentication', () => {
  before('Environment init', () => {
    return environment.init();
  });

  it('Open home screen should show authentication dialog', () => {
    return environment.goto(environment.url)
      .wait('[data-ta-container="login-page"]');
  });

  it('Filling out the authentication with wrong details should result in an error', () => {
    return environment.nightmare
      .insert('[data-ta-container="login-page"] [data-ta-input="username"]', testuser.username)
      .insert('[data-ta-container="login-page"] [data-ta-input="password"]', 'notthepassword')
      .click('[data-ta-container="login-page"] [data-ta-clickable="submit"]')
      .wait('[data-ta-element="login-error"]');
  });

  it('Filling out the authentication should bring you to the home screen', () => {
    return environment.nightmare
      .insert('[data-ta-container="login-page"] [data-ta-input="username"]')
      .insert('[data-ta-container="login-page"] [data-ta-input="username"]', testuser.username)
      .insert('[data-ta-container="login-page"] [data-ta-input="password"]')
      .insert('[data-ta-container="login-page"] [data-ta-input="password"]', testuser.password)
      .click('[data-ta-container="login-page"] [data-ta-clickable="submit"]')
      .wait('[data-ta-container="home-page"]');
  });

  after('Environment stop', () => {
    return environment.shutdown();
  });
});
