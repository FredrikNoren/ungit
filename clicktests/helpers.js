var helpers = exports;

helpers.log = function(text) {
  console.log((new Date()).toISOString(), text);
}

helpers.elementExists = function(page, selector) {
  helpers.log('Querying element exists: ' + selector);
  var element = page.evaluate(function(selector) {
    var element =  document.querySelector(selector);
    return element ? { selector: selector, textContent: element.textContent } : null;
  }, selector);
  if (element) {
    helpers.log('Element exists: ' + selector);
  } else {
    helpers.log('Element doesn\'t exist: ' + selector);
  }
  return element;
}

helpers.elementVisible = function(page, selector) {
  helpers.log('Querying element visible: ' + selector);
  var element = page.evaluate(function(selector) {
    var element = document.querySelector(selector);
    if (!element) return null;
    var rect = element.getBoundingClientRect();
    if (rect.width == 0 || rect.height == 0) return null;
    return { selector: selector, textContent: element.textContent };
  }, selector);
  if (element) {
    helpers.log('Element visible: ' + selector);
  } else {
    helpers.log('Element not visible: ' + selector);
  }
  return element;
}

helpers.waitFor = function(query, callback) {
  var tryFind = function() {
    var res = query();
    if (res) callback(res);
    else setTimeout(tryFind, 250);
  }
  tryFind();
}

helpers.waitForElementVisible = function(page, selector, callback) {
  helpers.log('Waiting for element visible: ' + selector);
  helpers.waitFor(function() {
    return helpers.elementVisible(page, selector);
  }, callback);
}

helpers.waitForElementExists = function(page, selector, callback) {
  helpers.log('Waiting for element exists: ' + selector);
  helpers.waitFor(function() {
    return helpers.elementExists(page, selector);
  }, callback);
}

helpers.waitForElementNotVisible = function(page, selector, callback) {
  helpers.log('Waiting for element not visible: ' + selector);
  helpers.waitFor(function() {
    if (helpers.elementVisible(page, selector)) return false;
    else return true;
  }, callback);
}

helpers.getClickPosition = function(page, selector) {
  var rect = page.evaluate(function(selector) {
    var el = document.querySelector(selector);
    if (!el) return undefined;
    return el.getBoundingClientRect();
  }, selector);
  if (!rect) {
    helpers.log('getClickPosition error: No rect for: ' + selector);
    page.render('clicktests/screenshots/error.png');
    phantom.exit(1);
  }
  if (rect.width == 0 || rect.height == 0) {
    helpers.log('getClickPosition error: Zero area for click selector: ' + selector);
    page.render('clicktests/screenshots/error.png');
    phantom.exit(1);
  }
  var x = rect.left + (rect.width/2);
  var y = rect.top + (rect.height/2);
  return { left: x, top: y };
}
helpers.click = function(page, selector) {
  var pos = helpers.getClickPosition(page, selector);
  helpers.log('Trying to click ' + selector, "|", pos.left, pos.top);
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
