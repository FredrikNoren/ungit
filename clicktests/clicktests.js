var webpage = require('webpage');
var child_process = require('child_process');
var expect = require('../node_modules/expect.js/expect');
var async = require('../node_modules/async/lib/async');
var cliColor = require('../node_modules/ansi-color/lib/ansi-color');

var config = {
	port: 8449
};

function log(text) {
	console.log((new Date()).toISOString(), text);
}

function createPage(onError) {
	var page = webpage.create();
	page.viewportSize = { width: 1024, height: 768 };
	page.onConsoleMessage = function(msg, lineNum, sourceId) {
	    console.log('[ui] ' + sourceId + ':' + lineNum + ' ' + msg);
	};
	page.onError = function(msg, trace) {
		console.log(msg);
		trace.forEach(function(t) {
			console.log(t.file + ':' + t.line + ' ' + t.function);
		});
		onError(msg);
	};
	page.onResourceError = function(resourceError) {
	    log('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
	    log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
	};
	page.onResourceRequested = function(requestData, networkRequest) {
	    log('Request (#' + requestData.id + '): ' + requestData.url);
	    // Abort gravatar requests to speed up things (since they will anyway only fail)
	    if (requestData.url.indexOf('http://www.gravatar.com/avatar/') == 0) {
	    	networkRequest.abort();
	    }
	};
	page.onResourceReceived = function(response) {
		if (response.stage == 'end')
	    	log('Response (#' + response.id + ', stage "' + response.stage + '")');
	};
	return page;
}


function prependLines(pre, text) {
	return text.split('\n').filter(function(l) { return l; }).map(function(line) { return pre + line; }).join('\n');
}

function startUngitServer(options, callback) {
	log('Starting ungit server...', options);
	var hasStarted = false;
	options = ['bin/ungit', 
		'--port=' + config.port, 
		'--no-launchBrowser', 
		'--dev', 
		'--no-bugtracking', 
		'--autoShutdownTimeout=10000', 
		'--maxNAutoRestartOnCrash=0', 
		'--logGitCommands']
		.concat(options);
	var ungitServer = child_process.spawn('node', options);
	ungitServer.stdout.on("data", function (data) {
		//console.log(prependLines('[server] ', data));
		
		if (data.toString().indexOf('Ungit server already running') >= 0) {
			callback('server-already-running');
		}

		if (data.toString().indexOf('## Ungit started ##') >= 0) {
			if (hasStarted) throw new Error('Ungit started twice, probably crashed.');
			hasStarted = true;
			log('Ungit server started.');
			callback();
		}
	});
	ungitServer.stderr.on("data", function (data) {
		console.log(prependLines('[server ERROR] ', data));
	});
	ungitServer.on('exit', function() {
		log('UNGIT SERVER EXITED');
	})
}

function createTestFile(filename, callback) {

	var tempPage = createPage(function(err) {
		console.error('Caught error');
		phantom.exit(1);
	});

	var url = 'http://localhost:' + config.port + '/api/testing/createfile?file=' + encodeURIComponent(filename);
	tempPage.open(url, 'POST', function(status) {
		if (status == 'fail') return callback({ status: status, content: page.plainText });
		tempPage.close();
		callback();
	});
}

function taIdToSelector(id) {
	return '[data-ta="' + id + '"]';
}

function getElementPosition(page, id) {
	return page.evaluate(function(selector) {
		return $(selector).offset();
	}, taIdToSelector(id));
}

function getClickPosition(page, id) {
	return page.evaluate(function(selector) {
		var el = $(selector);
		return {
			left: el.offset().left + el.width() / 2,
			top: el.offset().top + el.height() / 2,
		};
	}, taIdToSelector(id));	
}

function waitForElement(page, id, callback) {
	var tryFind = function() {
		log('Trying to find element: ' + id);
		var found = page.evaluate(function(selector) {
			return $(selector).length > 0;
		}, taIdToSelector(id));
		if (found) {
			log('Found element: ' + id);
			callback();
		}
		else setTimeout(tryFind, 500);
	}
	tryFind();
}

function waitForNotElement(page, id, callback) {
	var tryFind = function() {
		log('Trying to NOT find element: ' + id);
		var found = page.evaluate(function(selector) {
			return $(selector).length > 0;
		}, taIdToSelector(id));
		if (!found) {
			log('Found no element matching: ' + id);
			callback();
		}
		else setTimeout(tryFind, 500);
	}
	tryFind();
}

function expectNotFindElement(page, id) {
	var found = page.evaluate(function(selector) {
		return $(selector).length > 0;
	}, taIdToSelector(id));
	if (found) throw new Error('Expected to not find ' + id + ' but found it.');
}

function click(page, id) {
	log('Trying to click ' + id);
	var pos = getClickPosition(page, id);
	page.sendEvent('click', pos.left, pos.top);
}

var tests = [];

function test(name, description) {
	tests.push({ name: name, description: description });
}
function runTests() {
	async.series(tests.map(function(test) {
		return function(callback) {
			log(cliColor.set('## Running test: ' + test.name, 'magenta'));
			var timeout = setTimeout(function() {
				console.error('Test timeouted!');
				callback('timeout');
			}, 10000);
			test.description(function(err, res) {
				clearTimeout(timeout);
				if (err) {
					log(JSON.stringify(err));
					log(cliColor.set('## Test failed: ' + test.name, 'red'));
				}
				else log(cliColor.set('## Test ok: ' + test.name, 'green'));
				callback(err, res);
			});
		}
	}), function(err) {
		if (err) {
			console.error('Tests failed!');
			phantom.exit(1);
		} else {
			console.log('All tests ok!');
			phantom.exit(0);
		}
	});
}

var page = createPage(function(err) {
	console.error('Caught error');
	phantom.exit(1);
});

test('Open home screen', function(done) {
	page.open('http://localhost:' + config.port, function() {
		waitForElement(page, 'home-page', function() {
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
		waitForElement(page, 'uninited-path-page', function() {
			done();
		});
	});
});

test('Init repository should bring you to repo page', function(done) {
	click(page, 'init-repository');
	waitForElement(page, 'repository-view', function() {
		expectNotFindElement(page, 'remote-error-popup');
		done();
	});
});

test('Clicking loggo should bring you to home screen', function(done) {
	click(page, 'home-link');
	waitForElement(page, 'home-page', function() {
		done();
	});
});

test('Entering a path to a repo should bring you to that repo', function(done) {
	click(page, 'navigation-path');
	page.sendEvent('keypress', testRepoPath + '\n');
	waitForElement(page, 'repository-view', function() {
		done();
	});
});

test('Creating a file should make it show up in staging', function(done) {
	createTestFile(testRepoPath + '/testfile.txt', function(err) {
		if (err) return done(err);
		waitForElement(page, 'staging-file', function() {
			done();
		});
	});
});

test('Committing a file should remove it from staging and make it show up in log', function(done) {
	click(page, 'staging-commit-title')
	page.sendEvent('keypress', 'My commit message');
	setTimeout(function() {
		click(page, 'commit');
		waitForElement(page, 'node', function() {
			expectNotFindElement(page, 'staging-file');
			done();
		});
	}, 100);
});

test('Should be possible to discard a created file', function(done) {
	createTestFile(testRepoPath + '/testfile2.txt', function(err) {
		if (err) return done(err);
		waitForElement(page, 'staging-file', function() {
			click(page, 'discard-file');
			waitForNotElement(page, 'staging-file', function() {
				done();
			});
		});
	});
});


// ----------- CLONING -------------

var testClonePath;

test('Enter path to test root', function(done) {
	click(page, 'navigation-path');
	page.sendEvent('keypress', page.event.key.A, null, null, 0x04000000 );
	page.sendEvent('keypress', testRootPath + '\n');
	waitForElement(page, 'uninited-path-page', function() {
		done();
	});
});

test('Clone repository should bring you to repo page', function(done) {
	testClonePath = testRootPath + '/testclone';
	click(page, 'clone-url-input');
	page.sendEvent('keypress', testRepoPath);
	click(page, 'clone-target-input');
	page.sendEvent('keypress', testClonePath);
	click(page, 'clone-repository');
	waitForElement(page, 'repository-view', function() {
		expectNotFindElement(page, 'remote-error-popup');
		done();
	});
});



startUngitServer([], function(err) {
	if (err) {
		console.error('Failed to start ungit server');
		phantom.exit(1);
	}

	runTests();
});