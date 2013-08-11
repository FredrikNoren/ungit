
var Api = function() {
	this.connected = new signals.Signal();
	this.disconnected = new signals.Signal();
	this.repositoryChanged = new signals.Signal();
	this.getCredentialsHandler = function() { throw new Error("Not implemented"); }
	this._initSocket();
}
Api.prototype._initSocket = function() {
	var self = this;
	this.socket = io.connect();
	this.socket.on('error', function(err) {
		throw new Error('Socket error: ' + err.toString());
	});
	this.socket.on('disconnect', function(data) {
		self.disconnected.dispatch();
	});
	this.socket.on('connected', function (data) {
		self.socketId = data.socketId;
	});
	this.socket.on('changed', function (data) {
		self.repositoryChanged.dispatch(data);
	});
	this.socket.on('request-credentials', function (data) {
		self.getCredentialsHandler(function(credentials) {
			self.socket.emit('credentials', credentials);
		});
	});
}
Api.prototype.query = function(method, path, body, callback) {
	var q = superagent(method, '/api' + path);
	if (method == 'GET')
		q.query(body);
	else
		q.send(body);
	q.set('Accept', 'application/json');
	q.end(function(error, res) {
		if (error || !res.ok) {
			var errorSummary = 'unkown';
			if (res) {
				if (res.body) {
					if (res.body.errorCode && res.body.errorCode != 'unkown') errorSummary = res.body.errorCode;
					else if (typeof(res.body.error) == 'string') errorSummary = res.body.error.split('\n')[0];
					else errorSummary = JSON.stringify(res.body.error);
				}
				else errorSummary = res.xhr.statusText + ' ' + res.xhr.status;
			}
			var err = { errorSummary: errorSummary, error: error, res: res, errorCode: res && res.body ? res.body.errorCode : 'unkown' };
			if (callback && callback(err)) return;
			else {
				if (ungit.config.bugtracking)
					bugsense.addExtraData('data', JSON.stringify(err));
				throw new Error('Backend: ' + path + ', ' + errorSummary);
			}
		}
		else if (callback)
			callback(null, res.body);
	});
};
Api.prototype.watchRepository = function(repositoryPath, callback) {
	var self = this;
	
	this.socket.emit('watch', { path: repositoryPath }, callback);
};