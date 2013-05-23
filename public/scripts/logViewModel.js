


var LogEntryViewModel = function(entry) {
	var self = this;
	this.graphNodeX = ko.observable(0);
	this.graphNodeY = ko.observable(0);
	this.x = ko.computed(function() {
		return 0;
	});
	this.y = ko.computed(function() {
		return self.graphNodeY();
	});
	this.time = moment(entry.date);
	this.refs = entry.refs || [];
	this.parents = entry.parents || [];
	this.title = entry.title;
	this.sha1 = entry.sha1;
	this.date = entry.date;
	this.authorName = entry.authorName;
	this.authorEmail = entry.authorEmail;
}

LogEntryViewModel.fromBackendList = function(log) {
	return log.map(function(entry) { return new LogEntryViewModel(entry); });
}

var BranchViewModel = function(path, branch) {
	this.x = ko.observable(0);
	this.y = ko.observable(0);
	this.name = branch.name;
	this.current = branch.current;
	this.path = path;
}
BranchViewModel.prototype.checkout = function() {
	api.query('POST', '/branch', { path: this.path, name: this.name });
}