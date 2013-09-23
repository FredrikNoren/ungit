
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
		console.log('OPEN DONE')
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


test('Entering a path to a repo should bring you to that repo', function(done) {
	helpers.click(page, '[data-ta="navigation-path"]');
	helpers.selectAll(page);
	helpers.write(page, testRepoPath + '\n');
	helpers.waitForElement(page, '[data-ta="repository-view"]', function() {
		done();
	});
});

var createCommitWithNewFile = function(fileName, commitMessage, callback) {
	createTestFile(testRepoPath + '/' + fileName, function(err) {
		if (err) return done(err);
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
	createCommitWithNewFile('testfile.txt', 'My commit message', function() {
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

var createBranch = function(name, callback) {
	helpers.log('Createing branch ' + name);
	helpers.click(page, '[data-ta="show-new-branch-form"]');
	helpers.click(page, '[data-ta="new-branch-name"]');
	helpers.write(page, name);
	setTimeout(function() {
		helpers.click(page, '[data-ta="create-branch"]');
		helpers.waitForElement(page, '[data-ta="branch"][data-ta-name="' + name + '"]', function() {
			callback();
		});
	}, 100);
}

test('Should be possible to create a branch', function(done) {
	createBranch('testbranch', done);
});

/*
test('Should be possible to create another a branch', function(done) {
	setTimeout(function() {
		createBranch('lol', done);
	}, 2000);
});

test('Should be possible to create and destroy a branch', function(done) {
	createBranch('willbedeleted', function() {
		click(page, '[data-ta="branch"][data-ta-name="willbedeleted"]');
		click(page, '[data-ta-action="delete"][data-ta-visible="true"]');
		waitForNotElement(page, '[data-ta="branch"][data-ta-name="willbedeleted"]', function() {
			done();
		});
	});
});
*/

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

function refAction(page, ref, action, callback) {
	helpers.click(page, '[data-ta="branch"][data-ta-name="' + ref + '"]');
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
	refAction(page, 'testbranch', 'rebase', done);
});

test('Checkout master again', function(done) {
	checkout(page, 'master', done);
});

test('Create yet another commit', function(done) {
	createCommitWithNewFile('testy3.txt', 'Branch commit', done);
});

test('Merge', function(done) {
	refAction(page, 'testbranch', 'merge', done);
});


// ----------- CLONING -------------

var testClonePath;

test('Enter path to test root', function(done) {
	helpers.click(page, '[data-ta="navigation-path"]');
	helpers.selectAll(page);
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

test('Should be possible to fetch', function(done) {
	helpers.click(page, '[data-ta="fetch"]');
	helpers.waitForElement(page, '[data-ta="fetch"] [data-ta="progress-bar"]', function() {
		helpers.waitForNotElement(page, '[data-ta="fetch"] [data-ta="progress-bar"]', function() {
			done();
		});
	});
});

test('Should be possible to create and push a branch', function(done) {
	createBranch('branchinclone', function() {
		refAction(page, 'branchinclone', 'push', done);
	});
});


// Cleanup

test('Go to home screen', function(done) {
	helpers.click(page, '[data-ta="home-link"]');
	helpers.waitForElement(page, '[data-ta="home-page"]', function() {
		done();
	});
});

test('Cleanup test directories', function(done) {
	backgroundAction('POST', 'http://localhost:' + config.port + '/api/testing/cleanup', done);
});

test('Shutdown server should bring you to connection lost page', function(done) {
	shutdownServer(function() {
		helpers.waitForElement(page, '[data-ta="user-error-page"]', function() {
			done();
		});
	});
});

helpers.runTests();