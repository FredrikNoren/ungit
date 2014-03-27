var startTime = Date.now();

var webpage = require('webpage');
var child_process = require('child_process');
var async = require('../node_modules/async/lib/async');
var cliColor = require('../node_modules/ansi-color/lib/ansi-color');

var config = {
  port: 8449,
  testTimeout: 10000,
  serverTimeout: 10000,
  viewportSize: { width: 2000, height: 2000 },
  showServerOutput: false
};

var helpers = exports;

helpers.config = config;

helpers.log = function(text) {
  console.log((new Date()).toISOString(), text);
}

helpers.createPage = function(onError) {
  var page = webpage.create();
  page.viewportSize = config.viewportSize;
  page.onConsoleMessage = function(msg, lineNum, sourceId) {
    console.log('[ui] ' + sourceId + ':' + lineNum + ' ' + msg);
    if (msg.indexOf('git-error') != -1) {
      setTimeout(function() {
        page.render('clicktestout/error.png');
        console.log('git-error found, page rendered to error.png');
        phantom.exit(1);
      }, 20);
    }
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
    '--cliconfigonly',
    '--port=' + config.port, 
    '--no-launchBrowser', 
    '--dev', 
    '--no-bugtracking',
    '--no-sendUsageStatistics',
    '--autoShutdownTimeout=' + config.serverTimeout, 
    '--maxNAutoRestartOnCrash=0', 
    '--logGitCommands']
    .concat(options);
  var ungitServer = child_process.spawn('node', options);
  ungitServer.stdout.on("data", function (data) {
    if (config.showServerOutput) console.log(prependLines('[server] ', data));
    
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
  var items = helpers.getAllClickPositions(page, selector, false);
  if (items.length == 0) throw new Error('Can\'t find element ' + selector);
  var res = items[0];
  if (res.error) {
    page.render('clicktestout/error.png');
    throw new Error(res.error);
  }
  return res.clickPosition;
}

helpers.getAllClickPositions = function(page, selector, all) {
  if (all === undefined) all = true;
  return page.evaluate(function(args) {
    var selector = args.selector;
    var viewportSize = args.viewportSize;
    var items = [];
    var addItem = function(element, index) {
      var item = { index: index };
      var el = $(element);
      items.push(item);
      if (el.width() == 0 || el.height() == 0) {
        item.error = 'Area is zero of ' + element.outerHTML;
        return;
      }
      if (!el.offset()) {
        item.error = 'Item doesn\'t have an offset: ' + element.outerHTML;
        return;
      }
      item.clickPosition = {
        left: Math.floor(el.offset().left + el.width() / 2),
        top: Math.floor(el.offset().top + el.height() / 2),
      };
      if (item.clickPosition.left >= viewportSize.width || item.clickPosition.top >= viewportSize.height) {
        item.error = 'Trying to get a click position (' + item.clickPosition.left + ', ' + item.clickPosition.top + ') that is outside the viewport (' + viewportSize.width + ', ' + viewportSize.height + ')';
        return;
      }
      var actualElement = document.elementFromPoint(item.clickPosition.left, item.clickPosition.top);
      if (!actualElement) {
        item.error = 'Couldn\'t find any element at ' + item.clickPosition.left + ', ' + item.clickPosition.top + ' (looking for ' + selector + ')';
        return;
      }
      var soughtElement = actualElement;
      while (soughtElement && !$(soughtElement).is(selector))
        soughtElement = soughtElement.parentNode;
      if (!soughtElement) {
        item.error = 'Expected to find ' + selector + ' at position ' + item.clickPosition.left + ', ' + item.clickPosition.top + ' but found ' + actualElement.outerHTML;
        return;
      }
    }
    if (args.all)
      $(selector).each(function(index) { console.log(index, '=', this); addItem(this, index) });
    else if ($(selector).length > 0)
      addItem($(selector)[0], 0);
    return items;
  }, { selector: selector, viewportSize: config.viewportSize, all: all });
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
helpers.selectAllText = function(page) {
  helpers.log('Trying to select all in focused element (ctrl-A)');
  page.sendEvent('keypress', page.event.key.A, null, null, 0x04000000 );
}


var tests = [];

helpers.test = function(name, description) {
  tests.push({ name: name, description: description });
}
helpers.runTests = function(page) {
  async.series(tests.map(function(test) {
    return function(callback) {
      helpers.log(cliColor.set('## Running test: ' + test.name, 'magenta'));
      var timeout = setTimeout(function() {
        page.render('clicktestout/timeout.png')
        console.error('Test timeouted!');
        callback('timeout');
      }, config.testTimeout);
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
      console.log('All tests ok! Took ' + (Date.now() - startTime) / 1000 + 'sec (' + tests.length + ' tests)');
      phantom.exit(0);
    }
  });
}

