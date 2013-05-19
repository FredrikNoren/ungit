
var MockApi = function() {
	this.routers = {
		GET: crossroads.create(),
		POST: crossroads.create()
	};
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
	self.mockRoute('GET', '/status', {}, { errorCode: 'not-a-repository' });
	self.mockRoute('GET', '/log', []);
	self.mockRoute('POST', '/unstage', function() { self.fakeRepositoryChanged(); });
	self.mockRoute('POST', '/init', function() {
		self.mockRoute('GET', '/status', { files: [] });
		self.fakeRepositoryChanged();
	});
	self.mockRoute('POST', '/testing/createfile', function(body) {
		self.mockRoute('GET', '/status', { files: [ { name: body.file, isNew: true } ] });
		self.fakeRepositoryChanged();
	});
	self.mockRoute('POST', '/testing/changefile', function(body) {
		self.mockRoute('GET', '/status', { files: [ { name: body.file, isNew: false } ] });
		self.fakeRepositoryChanged();
	});
	self.mockRoute('POST', '/stage', function(body) {
		self.mockRoute('GET', '/status', { files: [ { name: body.file, isNew: true, staged: true } ] });
		self.fakeRepositoryChanged();
	});
	self.mockRoute('POST', '/commit', function() {
		self.mockRoute('GET', '/log', [ { title: 'Test' } ]);
		self.mockRoute('GET', '/status', { files: [] });
		self.fakeRepositoryChanged();
	});
	self.mockRoute('POST', '/discardchanges', function() {
		self.mockRoute('GET', '/status', { files: [] });
		self.fakeRepositoryChanged();
	});
}

var api = new MockApi();