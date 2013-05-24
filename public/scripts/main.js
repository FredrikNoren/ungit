
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

ko.bindingHandlers.graphLog = {
    init: function(element, valueAccessor) {
        var canvas = $('<canvas width="1000" height="2000">');
        $(element).append(canvas);
    },
    update: function(element, valueAccessor, allBindingsAccessor, viewModel) {
        var log = ko.utils.unwrapObservable(valueAccessor());
        var branches = ko.utils.unwrapObservable(viewModel.branches);
        if (!branches.length) return;
        var canvas = $(element).find('canvas').get(0);
        var onLogEntryPositionChanged = function(sha1, x, y) {
            var entry = _.find(log, function(l) { return l.sha1 == sha1; });
            entry.graphNodeX(x);
            entry.graphNodeY(y);
        }
        var onBranchPositionChanged = function(name, x, y) {
            var branch = _.find(branches, function(l) { return 'refs/heads/' + l.name == name; });
            branch.x(x);
            branch.y(y);
        }
        logRenderer.render(log, canvas, onLogEntryPositionChanged, onBranchPositionChanged);
    }
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