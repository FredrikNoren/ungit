
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
      var lastChar = $(element).val().slice(-1);
      if(lastChar == '/' || lastChar == '\\'){  // When "/" or "\"
        server.get('/fs/listDirectories', {term: $(element).val()}, function(err, directoryList) {
          if (err) {
            if (err.errorCode == 'read-dir-failed') return true;
            else return false;
          } else {
            $(element).autocomplete({
              source: directoryList,
              messages: {
                noResults: '',
                results: function() {}
              }
            });
            $(element).autocomplete("search", $(element).val());
          }
        });
      } else if(event.keyCode == 13){
        event.preventDefault();
        var url = '/#/repository?path=' + encodeURI($(element).val());
        window.location = url;
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
  this.disconnected = false;
}
WindowTitle.prototype.update = function() {
  var title = this.path.replace('\\', '/').split('/').filter(function(x) { return x; }).reverse().join(' < ');
  if (this.disconnected) title = ':( ' + title;
  document.title = title;
}

var windowTitle = new WindowTitle();
windowTitle.update();

var AppContainerViewModel = function() {
  var self = this;
  this.content = ko.observable();
  this.crash = ko.observable();
}
exports.AppContainerViewModel = AppContainerViewModel;
AppContainerViewModel.prototype.templateChooser = function(data) {
  if (!data) return '';
  return data.template;
};

var app, appContainer, server;
var DEFAULT_UNKOWN_CRASH = { title: 'Whooops', details: 'Something went wrong, reload the page to start over.' };

exports.start = function() {

  server = new Server();
  appContainer = new AppContainerViewModel();
  app = components.create('app', { appContainer: appContainer, server: server });
  programEvents.add(function(event) {
    if (event.event  == 'git-crash-error') {
      appContainer.crash(DEFAULT_UNKOWN_CRASH);
    } else if (event.event == 'disconnected') {
      appContainer.crash({ title: 'Connection lost', details: 'Refresh the page to try to reconnect' });
      windowTitle.disconnected = true;
      windowTitle.update();
    } else if (event.event == 'connected') {
      appContainer.crash(null);
      appContainer.content(app);
      windowTitle.disconnected = false;
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

  Raven.TraceKit.report.subscribe(function(err) {
    appContainer.crash(DEFAULT_UNKOWN_CRASH);
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
