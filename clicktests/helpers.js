var helpers = exports;

helpers.log = function(text) {
  console.log((new Date()).toISOString(), text);
}

helpers.waitForElement = function(page, selector, callback) {
  var tryFind = function() {
    helpers.log('Trying to find element: ' + selector);
    var element = page.evaluate(function(selector) {
      return document.querySelector(selector);
    }, selector);
    if (element) {
      helpers.log('Found element: ' + selector);
      callback(element);
    }
    else setTimeout(tryFind, 500);
  }
  tryFind();
}

helpers.waitForNotElement = function(page, selector, callback) {
  var tryFind = function() {
    helpers.log('Trying to NOT find element: ' + selector);
    var found = page.evaluate(function(selector) {
      return !!document.querySelector(selector);
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
    return !!document.querySelector(selector);
  }, selector);
  if (found) {
    console.log('expectNotFindElement error: Expected to not find ' + selector + ' but found it.');
    phantom.exit(1);
  }
}

helpers.getClickPosition = function(page, selector) {
  var rect = page.evaluate(function(selector) {
    var el = document.querySelector(selector);
    if (!el) return undefined;
    return el.getBoundingClientRect();
  }, selector);
  if (!rect) {
    console.log('getClickPosition error: No rect for: ' + selector);
    page.render('clicktests/screenshots/error.png');
    phantom.exit(1);
  }
  if (rect.width == 0 || rect.height == 0) {
    console.log('getClickPosition error: Zero area for click selector: ' + selector);
    page.render('clicktests/screenshots/error.png');
    phantom.exit(1);
  }
  var x = rect.left + (rect.width/2);
  var y = rect.top + (rect.height/2);
  return { left: x, top: y };
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



