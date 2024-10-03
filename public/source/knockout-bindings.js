/* eslint no-unused-vars: "off" */

var _ = require('lodash');
var ko = require('knockout');
var $ = require('jquery');
var { encodePath } = require('ungit-address-parser');
var navigation = require('ungit-navigation');
var storage = require('ungit-storage');

ko.bindingHandlers.debug = {
  init: function (element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    console.log('DEBUG INIT', value);
  },
  update: function (element, valueAccessor, allBindingsAccessor, viewModel) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    console.log('DEBUG UPDATE', value);
  },
};

ko.bindingHandlers.component = {
  init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
    ko.virtualElements.emptyNode(element);
    return { controlsDescendantBindings: true };
  },
  update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
    var component = ko.utils.unwrapObservable(valueAccessor());
    if (!component || !component.updateNode) {
      ko.virtualElements.emptyNode(element);
      return;
    }
    var node = component.updateNode(element);
    if (node) ko.virtualElements.setDomNodeChildren(element, [node]);
  },
};
ko.virtualElements.allowedBindings.component = true;

ko.bindingHandlers.editableText = {
  init: function (element, valueAccessor) {
    $(element).on('blur', function () {
      var observable = valueAccessor();
      observable($(this).text());
    });
  },
  update: function (element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    $(element).text(value);
  },
};

var currentlyDraggingViewModel = null;

ko.bindingHandlers.dragStart = {
  init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var value = valueAccessor();
    element.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('Text', 'ungit');
      currentlyDraggingViewModel = viewModel;
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(viewModel, true);
    });
  },
};
ko.bindingHandlers.dragEnd = {
  init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var value = valueAccessor();
    element.addEventListener('dragend', function () {
      currentlyDraggingViewModel = null;
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(viewModel, false);
    });
  },
};

ko.bindingHandlers.dropOver = {
  init: function (element, valueAccessor) {
    element.addEventListener('dragover', function (e) {
      var value = valueAccessor();
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      if (!valueUnwrapped) return;
      if (e.preventDefault) e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      return false;
    });
  },
};

ko.bindingHandlers.dragEnter = {
  init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    element.addEventListener('dragenter', function (e) {
      var value = valueAccessor();
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(viewModel, currentlyDraggingViewModel);
    });
  },
};

ko.bindingHandlers.dragLeave = {
  init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    element.addEventListener('dragleave', function (e) {
      var value = valueAccessor();
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(viewModel, currentlyDraggingViewModel);
    });
  },
};

ko.bindingHandlers.drop = {
  init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var value = valueAccessor();
    element.addEventListener('drop', function (e) {
      if (e.preventDefault) e.preventDefault();
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(viewModel, currentlyDraggingViewModel);
    });
  },
};

ko.bindingHandlers.shown = {
  init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var value = valueAccessor();
    var valueUnwrapped = ko.utils.unwrapObservable(value);
    valueUnwrapped.call(viewModel);
  },
};

ko.bindingHandlers.element = {
  init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var observable = valueAccessor();
    observable(element);
  },
};

(function scrollToEndBinding() {
  ko.bindingHandlers.scrolledToEnd = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
      element.valueAccessor = valueAccessor;
      element.viewModel = viewModel;
      element.setAttribute('data-scroll-to-end-listener', true);
    },
  };

  var checkAtEnd = function (element) {
    var elementEndY = $(element).offset().top + $(element).height();
    var windowEndY = $(document).scrollTop() + document.documentElement.clientHeight;
    if (windowEndY > elementEndY - document.documentElement.clientHeight / 2) {
      var value = element.valueAccessor();
      var valueUnwrapped = ko.utils.unwrapObservable(value);
      valueUnwrapped.call(element.viewModel);
    }
  };
  function scrollToEndCheck() {
    var elems = document.querySelectorAll('[data-scroll-to-end-listener]');
    for (var i = 0; i < elems.length; i++) checkAtEnd(elems[i]);
  }

  $(window).scroll(scrollToEndCheck);
  $(window).resize(scrollToEndCheck);
})();

// handle focus for this element and all children. only when this element or all of its chlidren have lost focus set the value to false.
ko.bindingHandlers.hasfocus2 = {
  init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var hasFocus = false;
    var timeout;

    ko.utils.registerEventHandler(element, 'focusin', handleElementFocusIn);
    ko.utils.registerEventHandler(element, 'focusout', handleElementFocusOut);

    function handleElementFocusIn() {
      hasFocus = true;
      valueAccessor()(true);
    }
    function handleElementFocusOut() {
      hasFocus = false;

      clearTimeout(timeout);
      timeout = setTimeout(function () {
        if (!hasFocus) {
          valueAccessor()(false);
        }
      }, 50);
    }
  },
};

ko.bindingHandlers.autocomplete = {
  init: (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) => {
    const setAutoCompleteOptions = (sources) => {
      $(element)
        .autocomplete({
          classes: {
            'ui-autocomplete': 'dropdown-menu',
          },
          source: sources,
          minLength: 0,
          messages: {
            noResults: '',
            results: () => {},
          },
        })
        .data('ui-autocomplete')._renderItem = (ul, item) => {
        return $('<li></li>').append($('<a>').text(item.label)).appendTo(ul);
      };
    };

    const handleKeyEvent = (event) => {
      const value = $(element).val();
      const lastChar = value.slice(-1);
      if (lastChar == ungit.config.fileSeparator) {
        // When file separator is entered, list what is in given path, and rest auto complete options
        ungit.server
          .getPromise('/fs/listDirectories', { term: value })
          .then((directoryList) => {
            const currentDir = directoryList.shift();
            $(element).val(
              currentDir.endsWith(ungit.config.fileSeparator)
                ? currentDir
                : currentDir + ungit.config.fileSeparator
            );
            setAutoCompleteOptions(directoryList);
            $(element).autocomplete('search', value);
          })
          .catch((err) => {
            if (
              !err.errorSummary.startsWith('ENOENT: no such file or directory') &&
              err.errorCode !== 'read-dir-failed'
            ) {
              throw err;
            }
          });
      } else if (event.keyCode === 13) {
        // enter key is struck, navigate to the path
        event.preventDefault();
        navigation.browseTo(`repository?path=${encodePath(value)}`);
      } else if (value === '' && storage.getItem('repositories')) {
        // if path is emptied out, show save path options
        const folderNames = JSON.parse(storage.getItem('repositories')).map((value) => {
          return {
            value: value,
            label: value.substring(value.lastIndexOf(ungit.config.fileSeparator) + 1),
          };
        });
        setAutoCompleteOptions(folderNames);
        $(element).autocomplete('search', '');
      }

      return true;
    };
    ko.utils.registerEventHandler(element, 'keyup', _.debounce(handleKeyEvent, 100));
  },
};
