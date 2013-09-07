var webpage = require('webpage');
var child_process = require('child_process');
var expect = require('../node_modules/expect.js/expect');
var async = require('../node_modules/async/lib/async');

var config = {
	port: 8449
};

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
	    console.log('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
	    console.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
	};
	return page;
}


function prependLines(pre, text) {
	return text.split('\n').filter(function(l) { return l; }).map(function(line) { return pre + line; }).join('\n');
}

function startUngitServer(options, callback) {
	console.log('Starting ungit server...', options);
	var hasStarted = false;
	var ungitServer = child_process.spawn('node', ['bin/ungit', '--port=' + config.port, '--no-launchBrowser', '--dev', '--no-bugtracking', '--autoShutdownTimeout=5000', '--maxNAutoRestartOnCrash=0'].concat(options));
	ungitServer.stdout.on("data", function (data) {
		console.log(prependLines('[server] ', data));
		
		if (data.toString().indexOf('Ungit server already running') >= 0) {
			callback('server-already-running');
		}

		if (data.toString().indexOf('## Ungit started ##') >= 0) {
			if (hasStarted) throw new Error('Ungit started twice, probably crashed.');
			hasStarted = true;
			console.log('Ungit server started.');
			callback();
		}
	});
	ungitServer.stderr.on("data", function (data) {
		console.log(prependLines('[server ERROR] ', data));
	});
}

function createTestDirectory(page, callback) {
	var url = 'http://localhost:' + config.port + '/api/testing/createdir';
	page.open(url, 'POST', function(status) {
		if (status == 'fail') return callback({ status: status, content: page.plainText });
		var json = JSON.parse(page.plainText);
		callback(null, json.path);
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
		console.log('Trying to find element: ' + id);
		var found = page.evaluate(function(selector) {
			return $(selector).length > 0;
		}, taIdToSelector(id));
		if (found) callback();
		else setTimeout(tryFind, 500);
	}
	tryFind();
}

function click(page, id) {
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
			console.log('## Running test: ' + test.name);
			var timeout = setTimeout(function() {
				console.error('Test timeouted!');
				callback('timeout');
			}, 3000);
			test.description(function(err, res) {
				clearTimeout(timeout);
				if (err) {
					console.log(JSON.stringify(err));
					console.log('## Test failed: ' + test.name);
				}
				else console.log('## Test ok: ' + test.name);
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

var testRepoPath;

test('Create test directory', function(done) {
	createTestDirectory(page, function(err, path) {
		if (err) return done(err);
		testRepoPath = path;
		done();
	});
});

test('Open path screen', function(done) {
	page.open('http://localhost:' + config.port + '/#/repository?path=' + encodeURIComponent(testRepoPath), function () {
		waitForElement(page, 'path-page', function() {
			done();
		});
	});
});

test('Init repository should bring you to repo page', function(done) {
	click(page, 'init-repository');
	waitForElement(page, 'repository-view', function() {
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

startUngitServer([], function(err) {
	if (err) {
		console.error('Failed to start ungit server');
		phantom.exit(1);
	}

	runTests();
});