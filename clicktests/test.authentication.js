
var helpers = require('./helpers');
var testsuite = require('./testsuite');
var Environment = require('./environment');
var webpage = require('webpage');

var page = webpage.create();
var suite = testsuite.newSuite('authentication', page);

var environment;

var testuser = { username: 'testuser', password: 'testpassword' }

suite.test('Init', function(done) {
  environment = new Environment(page, {
    port: 8450,
    serverStartupOptions: ['--authentication', '--users.' + testuser.username + '=' + testuser.password],
    showServerOutput: true
  });
  environment.init()
    .then(function() { done(); })
    .catch(done);
});

suite.test('Open home screen should show authentication dialog', function(done) {
  page.open(environment.url, function() {
    page.render('/tmp/ungit.png');
    helpers.waitForElementVisible(page, '[data-ta-container="login-page"]')
      .then(function() { done(); })
      .catch(done);
  })
});

suite.test('Filling out the authentication with wrong details should result in an error', function(done) {
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="username"]');
  helpers.write(page, testuser.username);
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="password"]');
  helpers.write(page, 'notthepassword');
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-clickable="submit"]');
  helpers.waitForElementVisible(page, '[data-ta-element="login-error"]')
    .then(function() {
      if (helpers.elementVisible(page, '[data-ta-container="home-page"]')) {
        throw new Error('Should not see home page');
      }
    }).then(function() { done(); })
    .catch(done);
});

suite.test('Filling out the authentication should bring you to the home screen', function(done) {
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="username"]');
  helpers.selectAllText(page);
  helpers.write(page, testuser.username);
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="password"]');
  helpers.selectAllText(page);
  helpers.write(page, testuser.password);
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-clickable="submit"]');
  helpers.waitForElementVisible(page, '[data-ta-container="home-page"]')
    .then(function() { done(); })
    .catch(done);
});

suite.test('Shutdown', function(done) {
  environment.shutdown()
    .then(function() { done(); })
    .catch(done);
});

testsuite.runAllSuits();
