
var _ = require('lodash');
var ko = require('knockout');
var $ = require('../vendor/js/jquery-2.0.0.min');
require('../vendor/js/jquery.dnd_page_scroll');
require('../vendor/js/bootstrap/modal');
require('../vendor/js/bootstrap/dropdown');
require('../vendor/js/bootstrap/tooltip');
require('../vendor/js/jquery-ui-1.10.3.custom.js');
require('./knockout-bindings');
var components = require('ungit-components');
var Server = require('./server');
var programEvents = require('ungit-program-events');
var navigation = require('ungit-navigation');

// Request animation frame polyfill
(function() {
  var lastTime = 0;
  var vendors = ['ms', 'moz', 'webkit', 'o'];
  for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
    window.cancelRequestAnimationFrame = window[vendors[x]+
      'CancelRequestAnimationFrame'];
  }

  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = function(callback, element) {
      var currTime = new Date().getTime();
      var timeToCall = Math.max(0, 16 - (currTime - lastTime));
      var id = window.setTimeout(function() { callback(currTime + timeToCall); },
        timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };

  if (!window.cancelAnimationFrame)
    window.cancelAnimationFrame = function(id) {
      clearTimeout(id);
    };

  programEvents.add(function(event) {
    if (event.event === 'init-tooltip') {
      $('.bootstrap-tooltip').tooltip();
    }
  });

}());

ko.bindingHandlers.autocomplete = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var handleKeyEvent = function(event) {
      var value = $(element).val();
      var lastChar = value.slice(-1);
      if (lastChar == '/' || lastChar == '\\') {  // When "/" or "\"
        server.getPromise('/fs/listDirectories', {term: value}).then(function(directoryList) {
          $(element).autocomplete({
            source: directoryList,
            messages: {
              noResults: '',
              results: function() {}
            }
          });
          $(element).autocomplete("search", value);
        }).catch(function(err) {
          if (!err.errorSummary.startsWith('ENOENT: no such file or directory') && err.errorCode !== 'read-dir-failed') {
            throw err;
          }
        });
      } else if (event.keyCode == 39) { // '/'
        $(element).val(value + ungit.config.fileSeparator);
      } else if (event.keyCode == 13) { // enter
        event.preventDefault();
        navigation.browseTo('repository?path=' + encodeURIComponent(value));
      } else if (localStorage.repositories && value.indexOf("/") === -1 && value.indexOf("\\") === -1) {
        var folderNames = localStorage.repositories.replace(/("|\[|\])/g, "")
          .split(",")
          .map(function(value) {
            return {
              value: value,
              label: value.substring(value.lastIndexOf("/") + 1)
            };
          });

        $(element).autocomplete({
          source: folderNames,
          messages: {
            noResults: '',
            results: function() {}
          }
        });
      }

      return true;
    };
    ko.utils.registerEventHandler(element, "keyup", _.debounce(handleKeyEvent, 100));
  }
};


// Used to catch when a user was tabbed away and re-visits the page.
// If fs.watch worked better on Windows (i.e. on subdirectories) we wouldn't need this
(function detectReActivity() {
  var lastMoved = Date.now();
  document.addEventListener('mousemove', function() {
    // If the user didn't move for 3 sec and then moved again, it's likely it's a tab-back
    if (Date.now() - lastMoved > 3000) {
      console.log('Fire change event due to re-activity');
      programEvents.dispatch({ event: 'working-tree-changed' });
    }
    lastMoved = Date.now();
  });
})();

function WindowTitle() {
  this.path = 'ungit';
  this.crash = false;
}
WindowTitle.prototype.update = function() {
  var title = this.path.replace('\\', '/').split('/').filter(function(x) { return x; }).reverse().join(' < ');
  if (this.crash) title = ':( ungit crash ' + title;
  document.title = title;
}

var windowTitle = new WindowTitle();
windowTitle.update();

var AppContainerViewModel = function() {
  var self = this;
  this.content = ko.observable();
}
exports.AppContainerViewModel = AppContainerViewModel;
AppContainerViewModel.prototype.templateChooser = function(data) {
  if (!data) return '';
  return data.template;
};

var app, appContainer, server;

exports.start = function() {

  server = new Server();
  appContainer = new AppContainerViewModel();
  app = components.create('app', { appContainer: appContainer, server: server });
  programEvents.add(function(event) {
    if (event.event == 'disconnected' || event.event == 'git-crash-error') {
      appContainer.content(components.create('crash', event.event));
      windowTitle.crash = true;
      windowTitle.update();
		} else if (event.event == 'connected') {
      appContainer.content(app);
      windowTitle.crash = false;
      windowTitle.update();
    }

    if (app.onProgramEvent) {
      app.onProgramEvent(event);
    }
  });
  if (ungit.config.authentication) {
    var authenticationScreen = components.create('login', { server: server });
    appContainer.content(authenticationScreen);
    authenticationScreen.loggedIn.add(function() {
      server.initSocket();
    });
  } else {
    server.initSocket();
  }

  Raven.TraceKit.report.subscribe(function(event, err) {
		appContainer.content(components.create('crash', event.event, err));
  });

  var prevTimestamp = 0;
  var updateAnimationFrame = function(timestamp) {
    var delta = timestamp - prevTimestamp;
    prevTimestamp = timestamp;
    if (app.updateAnimationFrame)
      app.updateAnimationFrame(delta);
    window.requestAnimationFrame(updateAnimationFrame);
  }
  window.requestAnimationFrame(updateAnimationFrame);

  ko.applyBindings(appContainer);

  // routing
  navigation.crossroads.addRoute('/', function() {
    app.content(components.create('home', { app: app }));
    windowTitle.path = 'ungit';
    windowTitle.update();
  });

  navigation.crossroads.addRoute('/repository{?query}', function(query) {
    programEvents.dispatch({ event: 'navigated-to-path', path: query.path });
    app.content(components.create('path', { server: server, path: query.path }));
    windowTitle.path = query.path;
    windowTitle.update();
  });

  navigation.init();
}


$(document).ready(function() {
  $().dndPageScroll(); // Automatic page scrolling on drag-n-drop: http://www.planbox.com/blog/news/updates/html5-drag-and-drop-scrolling-the-page.html
});
