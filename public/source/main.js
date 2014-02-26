
var _ = require('lodash');
var ko = require('knockout');
var $ = require('../vendor/js/jquery-2.0.0.min');
require('../vendor/js/jquery.dnd_page_scroll');
require('../vendor/js/bootstrap/modal');
require('../vendor/js/bootstrap/dropdown');
require('../vendor/js/jquery-ui-1.10.3.custom.js');
var components = require('./components');
var Server = require('./server');
var programEvents = require('./program-events');
var navigation = require('./navigation');

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
}());


var requestAnimationFrame = window.requestAnimationFrame;

ko.bindingHandlers.debug = {
  init: function(element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    console.log('DEBUG INIT', value);
  },
  update: function(element, valueAccessor, allBindingsAccessor, viewModel) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    console.log('DEBUG UPDATE', value);
  }
};

ko.bindingHandlers.component = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel) {
    ko.virtualElements.emptyNode(element);
    return { controlsDescendantBindings: true };
  },
  'update': function (element, valueAccessor, allBindings, viewModel, bindingContext) {
    var component = ko.utils.unwrapObservable(valueAccessor());
    var node = component.updateNode(element);
    if (node)
      ko.virtualElements.setDomNodeChildren(element, [node]);
  }
};
ko.virtualElements.allowedBindings.component = true;

ko.bindingHandlers.editableText = {
  init: function(element, valueAccessor) {
    $(element).on('blur', function() {
      var observable = valueAccessor();
      observable( $(this).text() );
    });
  },
  update: function(element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    $(element).text(value);
  }
};

var currentlyDraggingViewModel = null;

ko.bindingHandlers.dragStart = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var value = valueAccessor();
    element.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('Text', 'ungit');
      currentlyDraggingViewModel = viewModel;
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(viewModel, true);
    });
  }
}
ko.bindingHandlers.dragEnd = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var value = valueAccessor();
    element.addEventListener('dragend', function() {
      currentlyDraggingViewModel = null;
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(viewModel, false);
    });
  }
}


ko.bindingHandlers.dropOver = {
  init: function(element, valueAccessor) {
    element.addEventListener('dragover', function(e) {
      var value = valueAccessor();
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      if (!valueUnwrapped)
        return;
      if (e.preventDefault)
        e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      return false;
    });
  }
}

ko.bindingHandlers.dragEnter = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    element.addEventListener('dragenter', function(e) {
      var value = valueAccessor();
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(viewModel, currentlyDraggingViewModel);
    });
  }
}

ko.bindingHandlers.dragLeave = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    element.addEventListener('dragleave', function(e) {
      var value = valueAccessor();
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(viewModel, currentlyDraggingViewModel);
    });
  }
}

ko.bindingHandlers.drop = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var value = valueAccessor();
    element.addEventListener('drop', function(e) {
      if (e.preventDefault)
        e.preventDefault();
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(viewModel, currentlyDraggingViewModel);
    });
  }
}

ko.bindingHandlers.shown = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var value = valueAccessor();
    var valueUnwrapped = ko.utils.unwrapObservable(value);
    valueUnwrapped.call(viewModel);
  }
};


(function scrollToEndBinding() {
  ko.bindingHandlers.scrolledToEnd = {
    init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
      element.valueAccessor = valueAccessor;
      element.viewModel = viewModel;
      element.setAttribute('data-scroll-to-end-listener', true);
    }
  };

  var checkAtEnd = function(element) {
    var elementEndY = $(element).offset().top + $(element).height();
    var windowEndY = $(document).scrollTop() + document.documentElement.clientHeight;
    if ( windowEndY > elementEndY - document.documentElement.clientHeight / 2) {
      var value = element.valueAccessor();
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(element.viewModel);
    }
  }
  function scrollToEndCheck() {
    var elems = document.querySelectorAll('[data-scroll-to-end-listener]');
    for(var i=0; i < elems.length; i++)
      checkAtEnd(elems[i]);
  }

  $(window).scroll(scrollToEndCheck);
  $(window).resize(scrollToEndCheck);
})();

ko.bindingHandlers.modal = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    $(element).modal();
    var value = ko.utils.unwrapObservable(valueAccessor());
    $(element).on('hidden.bs.modal', function () {
      // Fire next event to let bootstrap figure out everything with the dom intract
      // (onclose will most likely result in the dom of the modal being removed)
      setTimeout(function() {
        value.onclose.call(viewModel);
      }, 1);
    });
    // Normally we could just remove the dialog by removing it from the viewmodel
    // so that knockout removes the corresponding dom, but since bootstrap also
    // creates additional dom we need to use their method for hiding to make sure
    // everything is cleaned up. Basically this method gives the viewModel a chance
    // to close itself using the bootstrap method.
    value.closer.call(viewModel, function() {
      $(element).modal('hide');
    });
  }
};

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

// For some reason the standard hasFocus binder doesn't fire events on div objects with tabIndex's
ko.bindingHandlers.hasFocus2 = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    element.addEventListener('focus', function() {
      valueAccessor()(true);
    });
    element.addEventListener('blur', function() {
      valueAccessor()(false);
    });
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
    if (event.event == 'disconnected') {
      appContainer.crash({ title: 'Connection lost', details: 'Refresh the page to try to reconnect' });
    } else if (event.event  == 'git-crash-error') {
      appContainer.crash(DEFAULT_UNKOWN_CRASH);
    } else {
      app.onProgramEvent(event);
    }
  });
  if (ungit.config.authentication) {
    var authenticationScreen = components.create('login', { server: server });
    appContainer.content(authenticationScreen);
    authenticationScreen.loggedIn.add(function() {
      server.initSocket(function() {
        appContainer.content(app);
      });
    });
  } else {
    server.initSocket(function() {
      appContainer.content(app);
    });
  }

  Raven.TraceKit.report.subscribe(function(err) {
    appContainer.crash(DEFAULT_UNKOWN_CRASH);
  });

  var prevTimestamp = 0;
  var updateAnimationFrame = function(timestamp) {
    var delta = timestamp - prevTimestamp;
    prevTimestamp = timestamp;
    app.updateAnimationFrame(delta);
    window.requestAnimationFrame(updateAnimationFrame);
  }
  window.requestAnimationFrame(updateAnimationFrame);

  ko.applyBindings(appContainer);

  // routing
  navigation.crossroads.addRoute('/', function() {
    app.path('');
    app.content(components.create('home', { app: app }));
  });

  navigation.crossroads.addRoute('/repository{?query}', function(query) {
    app.path(query.path);
    app.content(components.create('path', { server: server, path: query.path }));
  })

  navigation.init();
}


$(document).ready(function() {
  $().dndPageScroll(); // Automatic page scrolling on drag-n-drop: http://www.planbox.com/blog/news/updates/html5-drag-and-drop-scrolling-the-page.html
});
