var expect = require('expect.js');
var environment = require('./environment')({
  serverStartupOptions: ['--authentication', '--users.testuser=testpassword'],
  showServerOutput: true
});

describe('test authentication', function () {
  it('Environment init', function() {
    return environment.init();
  });

  it('Open home screen should show authentication dialog', function() {
    return environment.nightmare.goto(environment.url)
      .wait('[data-ta-container="login-page"]');
  });

  it('Environment stop', function() {
    return environment.shutdown();
  });
});
