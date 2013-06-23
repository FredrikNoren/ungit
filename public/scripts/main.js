
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

var updateThrobbers = function() {
    var throbbers = document.getElementsByClassName('throbber');
    for (var i=0; i< throbbers.length; i++) {
        var throbber = throbbers[i];
        var xy = throbber.style.backgroundPosition || '0px 0px';
        var x = xy.split(' ')[0].trim();
        x = parseInt(x.slice(0, x.length - 2));
        x = (x - 40) % 1440;
        throbber.style.backgroundPosition = x + 'px 0px';
    }
    requestAnimationFrame(updateThrobbers);
}
updateThrobbers();

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
            if ((typeof(value) == 'function' && !value(e)) || !value)
                return;
            if (e.preventDefault)
                e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            return false;
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
    },
    update: function(element, valueAccessor, allBindingsAccessor, viewModel) {
        var graph = ko.utils.unwrapObservable(valueAccessor());
        var canvas = $(element).find('canvas').get(0);
        logRenderer.render(canvas, graph);
    }
};

window.onerror = function() {
    viewModel.content(new CrashViewModel());
    viewModel.dialog(null);
    if (config.bugtracking)
        window.bugsense.onerror.apply(window.bugsense, arguments);
};

ko.applyBindings(viewModel);


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