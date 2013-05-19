
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