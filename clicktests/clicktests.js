
var expect = require('../node_modules/expect.js/index');
var helpers = require('./helpers');

var config = helpers.config;

var backgroundAction = function(method, url, callback) {
  var tempPage = helpers.createPage(function(err) {
    console.error('Caught error');
    phantom.exit(1);
  });
  tempPage.open(url, method, function(status) {
    if (status == 'fail') return callback({ status: status, content: tempPage.plainText });
    tempPage.close();
    callback();
  });
}

var createTestFile = function(filename, callback) {
  backgroundAction('POST', 'http://localhost:' + config.port + '/api/testing/createfile?file=' + encodeURIComponent(filename), callback);
}

var changeTestFile = function(filename, callback) {
  backgroundAction('POST', 'http://localhost:' + config.port + '/api/testing/changefile?file=' + encodeURIComponent(filename), callback);
}

var shutdownServer = function(callback) {
  backgroundAction('POST', 'http://localhost:' + config.port + '/api/testing/shutdown', callback);
}


var test = helpers.test;

var page = helpers.createPage(function(err) {
  console.error('Caught error');
  phantom.exit(1);
});


test('Init', function(done) {
  helpers.startUngitServer([], done);
});

test('Open home screen', function(done) {
  page.open('http://localhost:' + config.port, function() {
    helpers.waitForElement(page, '[data-ta-container="home-page"]', function() {
      done();
    });
  });
});

var testRootPath;

test('Create test root directory', function(done) {
  page.open('http://localhost:' + config.port + '/api/testing/createtempdir', 'POST', function(status) {
    if (status == 'fail') return done({ status: status, content: page.plainText });
    var json = JSON.parse(page.plainText);
    testRootPath = json.path;
    done();
  });
});

var testRepoPath;

test('Create test directory', function(done) {
  testRepoPath = testRootPath + '/testrepo';
  console.log(testRepoPath);
  page.open('http://localhost:' + config.port + '/api/createdir?dir=' + encodeURIComponent(testRepoPath), 'POST', function(status) {
    if (status == 'fail') return done({ status: status, content: page.plainText });
    done();
  });
});

test('Open path screen', function(done) {
  console.log(testRepoPath);
  page.open('http://localhost:' + config.port + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
    helpers.waitForElement(page, '[data-ta-container="uninited-path-page"]', function() {
      done();
    });
  });
});

test('Init repository should bring you to repo page', function(done) {
  helpers.click(page, '[data-ta-clickable="init-repository"]');
  helpers.waitForElement(page, '[data-ta-container="repository-view"]', function() {
    helpers.expectNotFindElement(page, '[data-ta-container="remote-error-popup"]');
    done();
  });
});

test('Clicking logo should bring you to home screen', function(done) {
  helpers.click(page, '[data-ta-clickable="home-link"]');
  helpers.waitForElement(page, '[data-ta-container="home-page"]', function() {
    done();
  });
});

test('Entering an invalid path and create directory in that location', function(done) {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.write(page, testRootPath + '/not/existing\n');
  helpers.waitForElement(page, '[data-ta-container="invalid-path"]', function() {  
    helpers.click(page, '[data-ta-clickable="create-dir"]');
    helpers.waitForElement(page, '[data-ta-clickable="init-repository"]', function() {
      done();
    });
  });
});

test('Entering an invalid path should bring you to an error screen', function(done) {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.write(page, '/a/path/that/doesnt/exist\n');
  helpers.waitForElement(page, '[data-ta-container="invalid-path"]', function() {
    done();
  });
});

var enterRepoByTypingPath = function(path, callback) {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.selectAllText(page);
  helpers.write(page, path + '\n');
  helpers.waitForElement(page, '[data-ta-container="repository-view"]', function() {
    callback();
  });
}

test('Entering a path to a repo should bring you to that repo', function(done) {
  enterRepoByTypingPath(testRepoPath, done);
});

var createCommitWithNewFile = function(fileName, commitMessage, isAmend, callback) {
  createTestFile(testRepoPath + '/' + fileName, function(err) {
    if (err) return callback(err);
    helpers.waitForElement(page, '[data-ta-container="staging-file"]', function() {
      if (isAmend) helpers.click(page, '[data-bind="click: toogleAmend"]');
      else {
        helpers.click(page, '[data-ta-input="staging-commit-title"]');
        helpers.write(page, commitMessage);
      }
      setTimeout(function() {
        helpers.click(page, '[data-ta-clickable="commit"]');
        helpers.waitForNotElement(page, '[data-ta-container="staging-file"]', function() {
          setTimeout(function() { // let the animation finish
            callback();
          }, 1000);
        });
      }, 100);
    });
  });
}

test('Should be possible to create and commit a file', function(done) {
  createCommitWithNewFile('testfile.txt', 'Init', false, function() {
    helpers.waitForElement(page, '[data-ta-container="node"]', function() {
      done();
    });
  })
});

test('Should be possible to amend a file', function(done) {
  createCommitWithNewFile('testfile100.txt', 'Init', true, function() {
    helpers.waitForElement(page, '[data-ta-container="node"]', function() {
      done();
    });
  })
});

test('Should be able to add a new file to .gitignore', function(done) {
  createTestFile(testRepoPath + '/addMeToIgnore.txt', function(err) {
    if (err) return done(err);
    helpers.waitForElement(page, '[data-ta-container="staging-file"]', function() {
      // add "addMeToIgnore.txt" to .gitignore
      helpers.click(page, '[data-ta-clickable="ignore-file"]');
      // add ".gitignore" to .gitignore
      //TODO I'm not sure what is the best way to detect page refresh, so currently wait for 1 sec and then click ignore-file. 
      setTimeout(function() {
        helpers.click(page, '[data-ta-clickable="ignore-file"]');
        helpers.waitForNotElement(page, '[data-ta-container="staging-file"]', function() {
          done();
        });
      }, 1000);
    });
  });
});

test('Test commit diff between git commit', function(done) {
  helpers.click(page, '[data-ta-clickable="node-clickable"]');
  helpers.click(page, '[data-ta-clickable="commitDiffFileName"]');
  helpers.waitForElement(page, '[data-ta-container="commitLineDiffs"]', function() {
    setTimeout(function() {                           // let it finish making api call
      helpers.click(page, '[class="graph"]');   // close opened sub diff by clicking away
      done();
    }, 1000);
  });
});

test('Should be possible to discard a created file', function(done) {
  createTestFile(testRepoPath + '/testfile2.txt', function(err) {
    if (err) return done(err);
    helpers.waitForElement(page, '[data-ta-container="staging-file"]', function() {
      helpers.click(page, '[data-ta-clickable="discard-file"]');
      helpers.waitForNotElement(page, '[data-ta-container="staging-file"]', function() {
        done();
      });
    });
  });
});

var createRef = function(name, type, callback) {
  helpers.log('Createing branch ' + name);
  helpers.click(page, '[data-ta-clickable="show-new-branch-form"]');
  helpers.click(page, '[data-ta-input="new-branch-name"]');
  helpers.write(page, name);
  setTimeout(function() {
    helpers.click(page, '[data-ta-clickable="create-' + type + '"]');
    helpers.waitForElement(page, '[data-ta-clickable="' + type + '"][data-ta-name="' + name + '"]', function() {
      callback();
    });
  }, 100);
}
var createBranch = function(name, callback) {
  createRef(name, 'branch', callback);
}
var createTag = function(name, callback) {
  createRef(name, 'tag', callback);
}

test('Should be possible to create a branch', function(done) {
  createBranch('testbranch', done);
});


test('Should be possible to create and destroy a branch', function(done) {
  createBranch('willbedeleted', function() {
    helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="willbedeleted"]');
    helpers.click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
    helpers.waitForNotElement(page, '[data-ta-clickable="branch"][data-ta-name="willbedeleted"]', function() {
      done();
    });
  });
});

test('Should be possible to create and destroy a tag', function(done) {
  createTag('tagwillbedeleted', function() {
    helpers.click(page, '[data-ta-clickable="tag"][data-ta-name="tagwillbedeleted"]');
    helpers.click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
    helpers.waitForNotElement(page, '[data-ta-clickable="tag"][data-ta-name="tagwillbedeleted"]', function() {
      done();
    });
  });
});

test('Commit changes to a file', function(done) {
  changeTestFile(testRepoPath + '/testfile.txt', function(err) {
    if (err) return done(err);
    helpers.waitForElement(page, '[data-ta-container="staging-file"]', function() {
      helpers.click(page, '[data-ta-input="staging-commit-title"]')
      helpers.write(page, 'My commit message');
      setTimeout(function() {
        helpers.click(page, '[data-ta-clickable="commit"]');
        helpers.waitForNotElement(page, '[data-ta-container="staging-file"]', function() {
          done();
        });
      }, 100);
    });
  });
});

function checkout(page, branch, callback) {
  helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="' + branch + '"]');
  helpers.click(page, '[data-ta-action="checkout"][data-ta-visible="true"]');
  helpers.waitForElement(page, '[data-ta-clickable="branch"][data-ta-name="' + branch + '"][data-ta-current="true"]', function() {
    callback();
  });
}

test('Checkout a branch', function(done) {
  checkout(page, 'testbranch', done);
});

test('Create another commit', function(done) {
  createCommitWithNewFile('testy2.txt', 'Branch commit', false, done);
});

function refAction(page, ref, local, action, callback) {
  helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="' + ref + '"][data-ta-local="' + local + '"]');
  helpers.mousemove(page, '[data-ta-action="' + action + '"][data-ta-visible="true"]');
  setTimeout(function() { // Wait for next animation frame
    helpers.click(page, '[data-ta-action="' + action + '"][data-ta-visible="true"]');
    helpers.waitForNotElement(page, '[data-ta-action="' + action + '"][data-ta-visible="true"]', function() {
      setTimeout(function() {
        callback();
      }, 500);
    })
  }, 200);
}

test('Rebase', function(done) {
  refAction(page, 'testbranch', true, 'rebase', done);
});

test('Checkout master again', function(done) {
  checkout(page, 'master', done);
});

test('Create yet another commit', function(done) {
  createCommitWithNewFile('testy3.txt', 'Branch commit', false, done);
});

test('Merge', function(done) {
  refAction(page, 'testbranch', true, 'merge', done);
});

function moveRef(page, ref, targetNodeCommitTitle, callback) {
  helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="' + ref + '"]');
  helpers.mousemove(page, '[data-ta-node-title="' + targetNodeCommitTitle + '"] [data-ta-action="move"][data-ta-visible="true"]');
  setTimeout(function() { // Wait for next animation frame
    helpers.click(page, '[data-ta-node-title="' + targetNodeCommitTitle + '"] [data-ta-action="move"][data-ta-visible="true"]');
    helpers.waitForNotElement(page, '[data-ta-action="move"][data-ta-visible="true"]', function() {
      setTimeout(function() {
        callback();
      }, 500);
    })
  }, 200);
}

test('Should be possible to move a branch', function(done) {
  createBranch('movebranch', function() {
    moveRef(page, 'movebranch', 'Init', done);
  });
});

// --- Adding remotes ---

var bareRepoPath;

test('Create a bare repo (not in ui)', function(done) {
  bareRepoPath = testRootPath + '/barerepo';
  backgroundAction('POST', 'http://localhost:' + config.port + '/api/createdir?dir=' + encodeURIComponent(bareRepoPath), function() {
    backgroundAction('POST', 'http://localhost:' + config.port + '/api/init?bare=true&path=' + encodeURIComponent(bareRepoPath), done);
  });
});

test('Adding a remote', function(done) {
  helpers.click(page, '[data-ta-clickable="remotes-menu"]');
  helpers.click(page, '[data-ta-clickable="show-add-remote-dialog"]');
  helpers.waitForElement(page, '[data-ta-container="add-remote"]', function() {
    helpers.click(page, '[data-ta-container="add-remote"] [data-ta-input="name"]');
    helpers.write(page, 'myremote');
    helpers.click(page, '[data-ta-container="add-remote"] [data-ta-input="url"]');
    helpers.write(page, bareRepoPath);
    helpers.click(page, '[data-ta-container="add-remote"] [data-ta-clickable="submit"]');
    helpers.waitForElement(page, '[data-ta-container="remotes"] [data-ta-clickable="myremote"]', function() {
      done();
    });
  });
});

test('Fetch from newly added remote', function(done) {
  fetch(function() {
    done();
  });
});

// ----------- CLONING -------------

var testClonePath;

test('Enter path to test root', function(done) {
  helpers.click(page, '[data-ta-input="navigation-path"]');
  helpers.selectAllText(page);
  helpers.write(page, testRootPath + '\n');
  helpers.waitForElement(page, '[data-ta-container="uninited-path-page"]', function() {
    done();
  });
});

test('Clone repository should bring you to repo page', function(done) {
  testClonePath = testRootPath + '/testclone';
  helpers.click(page, '[data-ta-input="clone-url"]');
  helpers.write(page, testRepoPath);
  helpers.click(page, '[data-ta-input="clone-target"]');
  helpers.write(page, testClonePath);
  helpers.click(page, '[data-ta-clickable="clone-repository"]');
  helpers.waitForElement(page, '[data-ta-container="repository-view"]', function() {
    helpers.expectNotFindElement(page, '[data-ta-container="remote-error-popup"]');
    setTimeout(function() { // Let animations finish
      done();
    }, 1000);
  });
});

var fetch = function(callback) {
  helpers.click(page, '[data-ta-clickable="fetch"]');
  helpers.waitForElement(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]', function() {
    helpers.waitForNotElement(page, '[data-ta-clickable="fetch"] [data-ta-element="progress-bar"]', function() {
      callback();
    });
  });
}

test('Should be possible to fetch', function(done) {
  fetch(done);
});

test('Should be possible to create and push a branch', function(done) {
  createBranch('branchinclone', function() {
    refAction(page, 'branchinclone', true, 'push', done);
  });
});

test('Should be possible to force push a branch', function(done) {
  moveRef(page, 'branchinclone', 'Init', function() {
    helpers.click(page, '[data-ta-clickable="branch"][data-ta-name="branchinclone"][data-ta-local="true"]');
    helpers.mousemove(page, '[data-ta-action="push"][data-ta-visible="true"]');
    setTimeout(function() { // Wait for next animation frame
      helpers.click(page, '[data-ta-action="push"][data-ta-visible="true"]');
      helpers.waitForElement(page, '[data-ta-container="yes-no-dialog"]', function() {
        helpers.click(page, '[data-ta-clickable="yes"]');
        helpers.waitForNotElement(page, '[data-ta-action="push"][data-ta-visible="true"]', function() {
          setTimeout(function() {
            done();
          }, 500);
        })
      });
    }, 200);
  });
});


// Shutdown

test('Go to home screen', function(done) {
  helpers.click(page, '[data-ta-clickable="home-link"]');
  helpers.waitForElement(page, '[data-ta-container="home-page"]', function() {
    // Clear local storage so that we don't end up with ever growing local storage
    page.evaluate(function() {
      localStorage.clear()
    });
    done();
  });
});

test('Shutdown server should bring you to connection lost page', function(done) {
  shutdownServer(function() {
    helpers.waitForElement(page, '[data-ta-container="user-error-page"]', function() {
      done();
    });
  });
});

// Test authentication

var testuser = { username: 'testuser', password: 'testpassword' }

test('Start with authentication', function(done) {
  helpers.startUngitServer(['--authentication', '--users.' + testuser.username + '=' + testuser.password], done);
});

test('Open home screen should show authentication dialog', function(done) {
  page.open('http://localhost:' + config.port, function() {
    helpers.waitForElement(page, '[data-ta-container="login-page"]', function() {
      done();
    });
  });
});

test('Filling out the authentication with wrong details should result in an error', function(done) {
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="username"]');
  helpers.write(page, testuser.username);
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="password"]');
  helpers.write(page, 'notthepassword');
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-clickable="submit"]');
  helpers.waitForElement(page, '[data-ta-element="login-error"]', function() {
    helpers.expectNotFindElement(page, '[data-ta-container="home-page"]')
    done();
  });
});

test('Filling out the authentication should bring you to the home screen', function(done) {
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="username"]');
  helpers.selectAllText(page);
  helpers.write(page, testuser.username);
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-input="password"]');
  helpers.selectAllText(page);
  helpers.write(page, testuser.password);
  helpers.click(page, '[data-ta-container="login-page"] [data-ta-clickable="submit"]');
  helpers.waitForElement(page, '[data-ta-container="home-page"]', function() {
    done();
  });
});

test('Shutdown server should bring you to connection lost page', function(done) {
  shutdownServer(function() {
    helpers.waitForElement(page, '[data-ta-container="user-error-page"]', function() {
      done();
    });
  });
});

// Test plugins

test('Start with authentication', function(done) {
  helpers.startUngitServer(['--pluginDirectory=' + phantom.libraryPath + '/test-plugins'], done);
});

test('Plugin should replace all of the app', function(done) {
  page.open('http://localhost:' + config.port, function() {
    helpers.waitForElement(page, '[data-ta-element="dummy-app"]', function() {
      helpers.expectNotFindElement(page, '[data-ta-container="app"]');
      done();
    });
  });
});

test('Cleanup and shutdown server', function(done) {
  backgroundAction('POST', 'http://localhost:' + config.port + '/api/testing/cleanup', function() {
    shutdownServer(function() {
      helpers.waitForElement(page, '[data-ta-container="user-error-page"]', function() {
        done();
      });
    });
  });
});


helpers.runTests(page);
