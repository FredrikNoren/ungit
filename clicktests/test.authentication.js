
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');
var uiInteractions = require('./ui-interactions.js');

var page = webpage.create();
var suite = testsuite.newSuite('authentication', page);

var environment;

var testuser = { username: 'testuser', password: 'testpassword' }

suite.test('Init', function() {
  environment = new Environment(page, {
    serverStartupOptions: ['--authentication', '--users.' + testuser.username + '=' + testuser.password],
    showServerOutput: true
  });
  return environment.init();
});

suite.test('Open home screen should show authentication dialog', function() {
  return uiInteractions.open(page, environment.url)
    .then(function() { return helpers.waitForElementVisible(page, '[data-ta-container="login-page"]'); });
});

suite.test('Filling out the authentication with wrong details should result in an error', function() {
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="username"]');
  helpers.write(page, testuser.username);
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="password"]');
  helpers.write(page, 'notthepassword');
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-clickable="submit"]');
  return helpers.waitForElementVisible(page, '[data-ta-element="login-error"]')
    .then(function() {
      if (helpers.elementVisible(page, '[data-ta-container="home-page"]')) {
        throw new Error('Should not see home page');
      }
    });
});

suite.test('Filling out the authentication should bring you to the home screen', function() {
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="username"]');
  helpers.selectAllText(page);
  helpers.write(page, testuser.username);
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="password"]');
  helpers.selectAllText(page);
  helpers.write(page, testuser.password);
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-clickable="submit"]');
  return helpers.waitForElementVisible(page, '[data-ta-container="home-page"]');
});

suite.test('Shutdown', function() {
  return environment.shutdown();
});

testsuite.runAllSuits();
