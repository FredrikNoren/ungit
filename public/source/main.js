
var _ = require('lodash');
var $ = require('jquery');
jQuery = $; // this is for old backward compatability of bootrap modules
var ko = require('knockout');
var dndPageScroll = require('dnd-page-scroll');
require('../vendor/js/bootstrap/modal');
require('../vendor/js/bootstrap/dropdown');
require('../vendor/js/bootstrap/tooltip');
require('jquery-ui-bundle');
require('./knockout-bindings');
var components = require('ungit-components');
var Server = require('./server');
var programEvents = require('ungit-program-events');
var navigation = require('ungit-navigation');
var storage = require('ungit-storage');
var adBlocker = require('just-detect-adblock');

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
  init: (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) => {
    const setAutoCompleteOptions = (sources) => {
      $(element).autocomplete({
        source: sources,
        minLength: 0,
        messages: {
          noResults: '',
          results: () => {}
        }
      }).data("ui-autocomplete")._renderItem = function (ul, item) {
        return $("<li></li>")
          .append($("<a>").text(item.label))
          .appendTo(ul);
      };
    }

    const handleKeyEvent = (event) => {
      const value = $(element).val();
      const lastChar = value.slice(-1);
      if (lastChar == ungit.config.fileSeparator) {
        // When file separator is entered, list what is in given path, and rest auto complete options
        server.getPromise('/fs/listDirectories', {term: value}).then((directoryList) => {
          const currentDir = directoryList.shift();
          $(element).val(currentDir.endsWith(ungit.config.fileSeparator) ? currentDir : currentDir + ungit.config.fileSeparator);
          setAutoCompleteOptions(directoryList)
          $(element).autocomplete('search', value);
        }).catch((err) => {
          if (!err.errorSummary.startsWith('ENOENT: no such file or directory') && err.errorCode !== 'read-dir-failed') {
            throw err;
          }
        });
      } else if (event.keyCode === 13) {
        // enter key is struck, navigate to the path
        event.preventDefault();
        navigation.browseTo(`repository?path=${encodeURIComponent(value)}`);
      } else if (value === '' && storage.getItem('repositories')) {
        // if path is emptied out, show save path options
        const folderNames = JSON.parse(storage.getItem('repositories')).map((value) => {
          return {
            value: value,
            label: value.substring(value.lastIndexOf(ungit.config.fileSeparator) + 1)
          };
        });
        setAutoCompleteOptions(folderNames);
        $(element).autocomplete('search', '');
      }

      return true;
    };
    ko.utils.registerEventHandler(element, 'keyup', _.debounce(handleKeyEvent, 100));
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
  var title = this.path.replace(/\\/g, '/').split('/').filter(function(x) { return x; }).reverse().join(' < ');
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
      console.error(`ungit crash: ${event.event}`, event.error)
      const err = event.event == 'disconnected' && adBlocker.isDetected() ? 'adblocker' : event.event;
      appContainer.content(components.create('crash', err));
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
    programEvents.dispatch({ event: 'raven-crash', error: err || event.event });
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
  dndPageScroll.default(); // Automatic page scrolling on drag-n-drop: http://www.planbox.com/blog/news/updates/html5-drag-and-drop-scrolling-the-page.html
});
