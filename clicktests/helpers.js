var startTime = Date.now();

var webpage = require('webpage');
var child_process = require('child_process');
var async = require('../node_modules/async/lib/async');
var cliColor = require('../node_modules/ansi-color/lib/ansi-color');

var config = {
	port: 8449
};

var helpers = exports;

helpers.config = config;

helpers.log = function(text) {
	console.log((new Date()).toISOString(), text);
}

helpers.createPage = function(onError) {
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
	    helpers.log('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
	    helpers.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
	};
	page.onResourceRequested = function(requestData, networkRequest) {
	    helpers.log('Request (#' + requestData.id + '): ' + requestData.method + ' ' + requestData.url);
	    // Abort gravatar requests to speed up things (since they will anyway only fail)
	    if (requestData.url.indexOf('http://www.gravatar.com/avatar/') == 0) {
	    	networkRequest.abort();
	    }
	};
	page.onResourceReceived = function(response) {
		if (response.stage == 'end')
	    	helpers.log('Response (#' + response.id + ', stage "' + response.stage + '")');
	};
	return page;
}


var prependLines = function(pre, text) {
	return text.split('\n').filter(function(l) { return l; }).map(function(line) { return pre + line; }).join('\n');
}

helpers.startUngitServer = function(options, callback) {
	helpers.log('Starting ungit server...', options);
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
			helpers.log('Ungit server started.');
			callback();
		}
	});
	ungitServer.stderr.on("data", function (data) {
		console.log(prependLines('[server ERROR] ', data));
	});
	ungitServer.on('exit', function() {
		helpers.log('UNGIT SERVER EXITED');
	})
}

helpers.getElementPosition = function(page, selector) {
	return page.evaluate(function(selector) {
		return $(selector).offset();
	}, selector);
}

helpers.getClickPosition = function(page, selector) {
	var res = page.evaluate(function(selector) {
		var el = $(selector);
		if (el.length == 0) return { error: 'Can\'t find element ' + selector };
		if (el.width() == 0 || el.height() == 0) return { error: 'Area of ' + selector + ' is zero.' };
		var clickPos = {
			left: Math.floor(el.offset().left + el.width() / 2),
			top: Math.floor(el.offset().top + el.height() / 2),
		};
		var actualElement = document.elementFromPoint(clickPos.left, clickPos.top);
		if (!actualElement)
			 return { error: 'Couldn\'t find any element at ' + clickPos.left + ', ' + clickPos.top + ' (looking for ' + selector + ')' };
		var soughtElement = actualElement;
		while (soughtElement && !$(soughtElement).is(selector))
			soughtElement = soughtElement.parentNode;
		if (!soughtElement)
			 return { error: 'Expected to find ' + selector + ' at position ' + clickPos.left + ', ' + clickPos.top + ' but found ' + actualElement.outerHTML };
		return { result: clickPos };
	}, selector);
	if (res.error) {
		page.render('clicktestout/error.png');
		throw new Error(res.error);
	}
	return res.result;
}

helpers.waitForElement = function(page, selector, callback) {
	var tryFind = function() {
		helpers.log('Trying to find element: ' + selector);
		var found = page.evaluate(function(selector) {
			return $(selector).length > 0;
		}, selector);
		if (found) {
			helpers.log('Found element: ' + selector);
			callback();
		}
		else setTimeout(tryFind, 500);
	}
	tryFind();
}

helpers.waitForNotElement = function(page, selector, callback) {
	var tryFind = function() {
		helpers.log('Trying to NOT find element: ' + selector);
		var found = page.evaluate(function(selector) {
			return $(selector).length > 0;
		}, selector);
		if (!found) {
			helpers.log('Found no element matching: ' + selector);
			callback();
		}
		else setTimeout(tryFind, 500);
	}
	tryFind();
}

helpers.expectNotFindElement = function(page, selector) {
	var found = page.evaluate(function(selector) {
		return $(selector).length > 0;
	}, selector);
	if (found) throw new Error('Expected to not find ' + selector + ' but found it.');
}

helpers.click = function(page, selector) {
	helpers.log('Trying to click ' + selector);
	var pos = helpers.getClickPosition(page, selector);
	page.sendEvent('mousemove', pos.left, pos.top);
	page.sendEvent('click', pos.left, pos.top);
}
helpers.mousemove = function(page, selector) {
	helpers.log('Moving mouse to ' + selector);
	var pos = helpers.getClickPosition(page, selector);
	page.sendEvent('mousemove', pos.left, pos.top);
}
helpers.write = function(page, text) {
	helpers.log('Writing ' + text);
	page.sendEvent('keypress', text);
}
helpers.selectAll = function(page) {
	helpers.log('Trying to select all in focused element (ctrl-A)');
	page.sendEvent('keypress', page.event.key.A, null, null, 0x04000000 );
}


var tests = [];

helpers.test = function(name, description) {
	tests.push({ name: name, description: description });
}
helpers.runTests = function() {
	async.series(tests.map(function(test) {
		return function(callback) {
			helpers.log(cliColor.set('## Running test: ' + test.name, 'magenta'));
			var timeout = setTimeout(function() {
				page.render('clicktestout/timeout.png')
				console.error('Test timeouted!');
				callback('timeout');
			}, 10000);
			test.description(function(err, res) {
				clearTimeout(timeout);
				if (err) {
					helpers.log(JSON.stringify(err));
					helpers.log(cliColor.set('## Test failed: ' + test.name, 'red'));
				}
				else helpers.log(cliColor.set('## Test ok: ' + test.name, 'green'));
				callback(err, res);
			});
		}
	}), function(err) {
		if (err) {
			console.error('Tests failed!');
			phantom.exit(1);
		} else {
			console.log('All tests ok! Took ' + (Date.now() - startTime) / 1000 + 'sec');
			phantom.exit(0);
		}
	});
}

