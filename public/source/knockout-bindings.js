
var _ = require('lodash');
var ko = require('knockout');
var $ = require('../vendor/js/jquery-2.0.0.min');

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
    if (!component || !component.updateNode) {
      ko.virtualElements.emptyNode(element);
      return;
    }
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

ko.bindingHandlers.element = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var observable = valueAccessor();
    observable(element);
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
