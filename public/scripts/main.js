
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

ko.bindingHandlers.fastClick = {
    init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    	var value = valueAccessor();
    	new google.ui.FastButton(element, function() {
    		var valueUnwrapped = ko.utils.unwrapObservable(value);
        	valueUnwrapped.call(viewModel);
    	});
    }
};

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
        element.addEventListener('dragstart', function() {
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
            var valueUnwrapped = ko.utils.unwrapObservable(value);
            valueUnwrapped.call(viewModel, currentlyDraggingViewModel);
        });
    }
}

ko.bindingHandlers.graphLog = {
    init: function(element, valueAccessor) {
        var canvas = $('<canvas width="200" height="500">');
        $(element).append(canvas);

        var prevTimestamp = 0;
        var updateAnimationFrame = function(timestamp) {
            var graph = ko.utils.unwrapObservable(valueAccessor());
            logRenderer.render(canvas.get(0), graph);
            if (document.contains(canvas.get(0))) // While the element is in the document
                requestAnimationFrame(updateAnimationFrame);
        }
        requestAnimationFrame(updateAnimationFrame);
    },
};

ko.bindingHandlers.shown = {
    init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var value = valueAccessor();
        var valueUnwrapped = ko.utils.unwrapObservable(value);
        valueUnwrapped.call(viewModel);
    }
};

ko.bindingHandlers.scrolledToEnd = {
    init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var checkAtEnd = function() {
            var elementEndY = $(element).offset().top + $(element).height();
            var windowEndY = $(document).scrollTop() + document.documentElement.clientHeight;
            if ( windowEndY > elementEndY - document.documentElement.clientHeight / 2) {
                var value = valueAccessor();
                var valueUnwrapped = ko.utils.unwrapObservable(value);
                valueUnwrapped.call(viewModel);
            }
        }
        $(window).scroll(checkAtEnd);
        $(window).resize(checkAtEnd);
    }
};

ko.bindingHandlers.modal = {
    init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        $(element).modal();
        var value = ko.utils.unwrapObservable(valueAccessor());
        $(element).on('hidden.bs.modal', function () {
            value.onclose.call(viewModel);
        });
        value.closer.call(viewModel, function() {
            $(element).modal('hide');
        });
    }
};

var prevTimestamp = 0;
var updateAnimationFrame = function(timestamp) {
    var delta = timestamp - prevTimestamp;
    prevTimestamp = timestamp;
    app.updateAnimationFrame(delta);
    requestAnimationFrame(updateAnimationFrame);
}
requestAnimationFrame(updateAnimationFrame);

window.onerror = function(err) {
    if (ungit.config.bugtracking)
        window.bugsense.onerror.apply(window.bugsense, arguments);
    app.content(new CrashViewModel());
};

api = new Api();
var main = new MainViewModel();
var app = new AppViewModel(main);

ko.applyBindings(app);


//setup hasher
function parseHash(newHash, oldHash){
  crossroads.parse(newHash);
}
hasher.initialized.add(parseHash); //parse initial hash
hasher.changed.add(parseHash); //parse hash changes


function browseTo(path) {
    hasher.setHash(path);
}

hasher.init();

$(document).ready(function() {
    $().dndPageScroll(); // Automatic page scrolling on drag-n-drop: http://www.planbox.com/blog/news/updates/html5-drag-and-drop-scrolling-the-page.html
});