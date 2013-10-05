
var expect = require('../node_modules/expect.js/expect');
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
		helpers.waitForElement(page, '[data-ta="home-page"]', function() {
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
	page.open('http://localhost:' + config.port + '/api/testing/createdir?dir=' + encodeURIComponent(testRepoPath), 'POST', function(status) {
		if (status == 'fail') return done({ status: status, content: page.plainText });
		done();
	});
});

test('Open path screen', function(done) {
	page.open('http://localhost:' + config.port + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
		helpers.waitForElement(page, '[data-ta="uninited-path-page"]', function() {
			done();
		});
	});
});

test('Init repository should bring you to repo page', function(done) {
	helpers.click(page, '[data-ta="init-repository"]');
	helpers.waitForElement(page, '[data-ta="repository-view"]', function() {
		helpers.expectNotFindElement(page, '[data-ta="remote-error-popup"]');
		done();
	});
});

test('Clicking logo should bring you to home screen', function(done) {
	helpers.click(page, '[data-ta="home-link"]');
	helpers.waitForElement(page, '[data-ta="home-page"]', function() {
		done();
	});
});

test('Entering an invalid path should bring you to an error screen', function(done) {
	helpers.click(page, '[data-ta="navigation-path"]');
	helpers.write(page, '/a/path/that/doesnt/exist\n');
	helpers.waitForElement(page, '[data-ta="invalid-path"]', function() {
		done();
	});
});

var enterRepoByTypingPath = function(path, callback) {
	helpers.click(page, '[data-ta="navigation-path"]');
	helpers.selectAllText(page);
	helpers.write(page, path + '\n');
	helpers.waitForElement(page, '[data-ta="repository-view"]', function() {
		callback();
	});
}

test('Entering a path to a repo should bring you to that repo', function(done) {
	enterRepoByTypingPath(testRepoPath, done);
});

var createCommitWithNewFile = function(fileName, commitMessage, callback) {
	createTestFile(testRepoPath + '/' + fileName, function(err) {
		if (err) return callback(err);
		helpers.waitForElement(page, '[data-ta="staging-file"]', function() {
			helpers.click(page, '[data-ta="staging-commit-title"]')
			helpers.write(page, commitMessage);
			setTimeout(function() {
				helpers.click(page, '[data-ta="commit"]');
				helpers.waitForNotElement(page, '[data-ta="staging-file"]', function() {
					setTimeout(function() { // let the animation finish
						callback();
					}, 1000);
				});
			}, 100);
		});
	});
}

test('Should be possible to create and commit a file', function(done) {
	createCommitWithNewFile('testfile.txt', 'Init', function() {
		helpers.waitForElement(page, '[data-ta="node"]', function() {
			done();
		});
	})
});

test('Should be possible to discard a created file', function(done) {
	createTestFile(testRepoPath + '/testfile2.txt', function(err) {
		if (err) return done(err);
		helpers.waitForElement(page, '[data-ta="staging-file"]', function() {
			helpers.click(page, '[data-ta="discard-file"]');
			helpers.waitForNotElement(page, '[data-ta="staging-file"]', function() {
				done();
			});
		});
	});
});

var createRef = function(name, type, callback) {
	helpers.log('Createing branch ' + name);
	helpers.click(page, '[data-ta="show-new-branch-form"]');
	helpers.click(page, '[data-ta="new-branch-name"]');
	helpers.write(page, name);
	setTimeout(function() {
		helpers.click(page, '[data-ta="create-' + type + '"]');
		helpers.waitForElement(page, '[data-ta="' + type + '"][data-ta-name="' + name + '"]', function() {
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
		helpers.click(page, '[data-ta="branch"][data-ta-name="willbedeleted"]');
		helpers.click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
		helpers.waitForNotElement(page, '[data-ta="branch"][data-ta-name="willbedeleted"]', function() {
			done();
		});
	});
});

test('Should be possible to create and destroy a tag', function(done) {
	createTag('tagwillbedeleted', function() {
		helpers.click(page, '[data-ta="tag"][data-ta-name="tagwillbedeleted"]');
		helpers.click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
		helpers.waitForNotElement(page, '[data-ta="tag"][data-ta-name="tagwillbedeleted"]', function() {
			done();
		});
	});
});

test('Commit changes to a file', function(done) {
	changeTestFile(testRepoPath + '/testfile.txt', function(err) {
		if (err) return done(err);
		helpers.waitForElement(page, '[data-ta="staging-file"]', function() {
			helpers.click(page, '[data-ta="staging-commit-title"]')
			helpers.write(page, 'My commit message');
			setTimeout(function() {
				helpers.click(page, '[data-ta="commit"]');
				helpers.waitForNotElement(page, '[data-ta="staging-file"]', function() {
					done();
				});
			}, 100);
		});
	});
});

function checkout(page, branch, callback) {
	helpers.click(page, '[data-ta="branch"][data-ta-name="' + branch + '"]');
	helpers.click(page, '[data-ta-action="checkout"][data-ta-visible="true"]');
	helpers.waitForElement(page, '[data-ta="branch"][data-ta-name="' + branch + '"][data-ta-current="true"]', function() {
		callback();
	});
}

test('Checkout a branch', function(done) {
	checkout(page, 'testbranch', done);
});

test('Create another commit', function(done) {
	createCommitWithNewFile('testy2.txt', 'Branch commit', done);
});

function refAction(page, ref, local, action, callback) {
	helpers.click(page, '[data-ta="branch"][data-ta-name="' + ref + '"][data-ta-local="' + local + '"]');
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
	createCommitWithNewFile('testy3.txt', 'Branch commit', done);
});

test('Merge', function(done) {
	refAction(page, 'testbranch', true, 'merge', done);
});

function moveRef(page, ref, targetNodeCommitTitle, callback) {
	helpers.click(page, '[data-ta="branch"][data-ta-name="' + ref + '"]');
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
	backgroundAction('POST', 'http://localhost:' + config.port + '/api/testing/createdir?dir=' + encodeURIComponent(bareRepoPath), function() {
		backgroundAction('POST', 'http://localhost:' + config.port + '/api/init?bare=true&path=' + encodeURIComponent(bareRepoPath), done);
	});
});

test('Adding a remote', function(done) {
	helpers.click(page, '[data-ta="remotes-menu"]');
	helpers.click(page, '[data-ta="show-add-remote-dialog"]');
	helpers.waitForElement(page, '[data-ta-dialog="add-remote"]', function() {
		helpers.click(page, '[data-ta-dialog="add-remote"] [data-ta="name"]');
		helpers.write(page, 'myremote');
		helpers.click(page, '[data-ta-dialog="add-remote"] [data-ta="url"]');
		helpers.write(page, bareRepoPath);
		helpers.click(page, '[data-ta-dialog="add-remote"] [data-ta="submit"]');
		helpers.waitForElement(page, '[data-ta-remote="myremote"]', function() {
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
	helpers.click(page, '[data-ta="navigation-path"]');
	helpers.selectAllText(page);
	helpers.write(page, testRootPath + '\n');
	helpers.waitForElement(page, '[data-ta="uninited-path-page"]', function() {
		done();
	});
});

test('Clone repository should bring you to repo page', function(done) {
	testClonePath = testRootPath + '/testclone';
	helpers.click(page, '[data-ta="clone-url-input"]');
	helpers.write(page, testRepoPath);
	helpers.click(page, '[data-ta="clone-target-input"]');
	helpers.write(page, testClonePath);
	helpers.click(page, '[data-ta="clone-repository"]');
	helpers.waitForElement(page, '[data-ta="repository-view"]', function() {
		helpers.expectNotFindElement(page, '[data-ta="remote-error-popup"]');
		setTimeout(function() { // Let animations finish
			done();
		}, 1000);
	});
});

var fetch = function(callback) {
	helpers.click(page, '[data-ta="fetch"]');
	helpers.waitForElement(page, '[data-ta="fetch"] [data-ta="progress-bar"]', function() {
		helpers.waitForNotElement(page, '[data-ta="fetch"] [data-ta="progress-bar"]', function() {
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
		helpers.click(page, '[data-ta="branch"][data-ta-name="branchinclone"][data-ta-local="true"]');
		helpers.mousemove(page, '[data-ta-action="push"][data-ta-visible="true"]');
		setTimeout(function() { // Wait for next animation frame
			helpers.click(page, '[data-ta-action="push"][data-ta-visible="true"]');
			helpers.waitForElement(page, '[data-ta="yes-no-dialog"]', function() {
				helpers.click(page, '[data-ta="yes"]');
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
	helpers.click(page, '[data-ta="home-link"]');
	helpers.waitForElement(page, '[data-ta="home-page"]', function() {
		done();
	});
});

test('Shutdown server should bring you to connection lost page', function(done) {
	shutdownServer(function() {
		helpers.waitForElement(page, '[data-ta="user-error-page"]', function() {
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
		helpers.waitForElement(page, '[data-ta="login-page"]', function() {
			done();
		});
	});
});

test('Filling out the authentication should bring you to the home screen', function(done) {
	helpers.click(page, '[data-ta="login-page"] [data-ta="input-username"]');
	helpers.write(page, testuser.username);
	helpers.click(page, '[data-ta="login-page"] [data-ta="input-password"]');
	helpers.write(page, testuser.password);
	helpers.click(page, '[data-ta="login-page"] [data-ta="submit"]');
	helpers.waitForElement(page, '[data-ta="home-page"]', function() {
		done();
	});
});

test('Cleanup and shutdown server', function(done) {
	backgroundAction('POST', 'http://localhost:' + config.port + '/api/testing/cleanup', function() {
		shutdownServer(function() {
			helpers.waitForElement(page, '[data-ta="user-error-page"]', function() {
				done();
			});
		});
	});
});


helpers.runTests(page);
