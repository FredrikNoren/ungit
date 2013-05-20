
var MockApi = function() {
	this.routers = {
		GET: crossroads.create(),
		POST: crossroads.create()
	};
	this.routers.GET.bypassed.add(function(request){
	    throw new Error('Unkown GET route: ' + request);
	});
	this.routers.POST.bypassed.add(function(request){
	    throw new Error('Unkown POST route: ' + request);
	});
	this.routes = {
		GET: {},
		POST: {}
	}
	this.repositoryWatchers = {};
}
MockApi.prototype.query = function(method, path, body, callback) {
	var self = this;
	setTimeout(function() {
		self.latestBody = body;
		self.latestCallback = function(err, data) {
			if (err) {
				if (callback && callback(err, data)) return;
				else throw new Exception('Unhandled error', err);
			} else {
				if (callback) callback(null, data);
			}
		}
		self.routers[method].parse(path);
	}, 1);
}
MockApi.prototype.mockRoute = function(method, route, data, errorData) {
	var self = this;
	if (this.routes[method][route]) this.routers[method].removeRoute(this.routes[method][route]);
	this.routes[method][route] = this.routers[method].addRoute(route, function() {
		var realData = data;
		var realErrorData = errorData;
		if (typeof(realData) == 'function') realData = realData(self.latestBody);
		if (typeof(realErrorData) == 'function') realErrorData = realErrorData(self.latestBody);
		self.latestCallback(realErrorData, realData);
	});
}
MockApi.prototype.watchRepository = function(repositoryPath, callbacks) {
	this.repositoryWatchers[repositoryPath] = callbacks;
	if (callbacks.ready) callbacks.ready();
}
MockApi.prototype.fakeRepositoryChanged = function(repositoryPath) {
	if (this.repositoryWatchers[repositoryPath].changed)
		this.repositoryWatchers[repositoryPath].changed();
}
MockApi.prototype.initSimpleMockServer = function() {
	var self = this;
	var log = [];
	var status = { files: {} };
	self.mockRoute('GET', '/status', {}, { errorCode: 'not-a-repository' });
	self.mockRoute('GET', '/log', function() { return log; });
	self.mockRoute('GET', '/config', { 'user.name': 'test', 'user.email': 'test@test.com' });
	self.mockRoute('POST', '/init', function() {
		self.mockRoute('GET', '/status', function() { return status; });
		self.fakeRepositoryChanged();
	});
	self.mockRoute('POST', '/testing/createfile', function(body) {
		status.files[body.file] = { isNew: true };
		self.fakeRepositoryChanged();
	});
	self.mockRoute('POST', '/testing/changefile', function(body) {
		status.files[body.file] = { isNew: false };
		self.fakeRepositoryChanged();
	});
	self.mockRoute('POST', '/commit', function(body) {
		if (!body.message || !body.files || body.files.length == 0)
			throw new Error('Bad request: ' + JSON.stringify(body));
		log.unshift({ title: body.message });
		body.files.forEach(function(file) { delete status.files[file]; });
		self.fakeRepositoryChanged();
	});
	self.mockRoute('POST', '/discardchanges', function(body) {
		delete status.files[body.file];
		self.fakeRepositoryChanged();
	});
}

var api = new MockApi();