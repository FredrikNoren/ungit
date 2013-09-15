
var signals = require('signals');
var superagent = require('../vendor/js/superagent');
var _ = require('underscore');

var ChangeHandler = function() {
	var self = this;
	this.signal = new signals.Signal();
	this._blockers = 0;
	this._triedToDispatchWhileBlocked = false;
	this._throttledDispatch = _.throttle(function(data) { self.signal.dispatch(data); }, 500);
}
ChangeHandler.prototype.incBlock = function() {
	if (this._blockers == 0) this._triedToDispatchWhileBlocked = false;
	// Block change events while we're doing this
	// since it's often quite ugly updating in the middle of
	// for instance a rebase
	this._blockers++;
}
ChangeHandler.prototype.decBlock = function() {
	this._blockers--;
	if (this._blockers == 0 && this._triedToDispatchWhileBlocked) {
		this._triedToDispatchWhileBlocked = false;
		this._throttledDispatch({ repository: null });
	}
}
ChangeHandler.prototype.dispatch = function(data) {
	if (this._blockers > 0) {
		this._triedToDispatchWhileBlocked = true;
		return;
	}
	this._throttledDispatch(data);
}


var Api = function() {
	var self = this;
	this.connected = new signals.Signal();
	this.disconnected = new signals.Signal();
	this.workingTreeChanged = new ChangeHandler();
	this.gitDirectoryChanged = new ChangeHandler();

	this.getCredentialsHandler = function() { throw new Error("Not implemented"); }
	this._initSocket();
}

module.exports = Api;

Api.prototype._initSocket = function() {
	var self = this;
	this.socket = io.connect();
	this.socket.on('error', function(err) {
		self._isConnected(function(connected) {
			if (connected) throw err;
			else self._onDisconnect();
		});
	});
	this.socket.on('disconnect', function(data) {
		self._onDisconnect();
	});
	this.socket.on('connected', function (data) {
		self.socketId = data.socketId;
	});
	this.socket.on('working-tree-changed', function (data) {
		self.workingTreeChanged.dispatch(data);
	});
	this.socket.on('git-directory-changed', function (data) {
		self.gitDirectoryChanged.dispatch(data);
	});
	this.socket.on('request-credentials', function (data) {
		self.getCredentialsHandler(function(credentials) {
			self.socket.emit('credentials', credentials);
		});
	});
}
// Check if the server is still alive
Api.prototype._isConnected = function(callback) {
	superagent('GET', '/api/ping')
		.set('Accept', 'application/json')
		.end(function(error, res) {
			callback(!error && res && res.ok);
		});
}
Api.prototype._onDisconnect = function() {
	if (this.isDisconnected) return;
	this.isDisconnected = true;
	this.disconnected.dispatch();
}
Api.prototype.query = function(method, path, body, callback) {
	var self = this;
	var q = superagent(method, '/api' + path);
	if (method == 'GET')
		q.query(body);
	else {
		q.send(body);
		this.workingTreeChanged.incBlock();
		this.gitDirectoryChanged.incBlock();
	}
	q.set('Accept', 'application/json');
	q.end(function(error, res) {
		if (method != 'GET') {
			self.workingTreeChanged.decBlock();
			self.gitDirectoryChanged.decBlock();
		}
		if (error || !res.ok) {
			// superagent faultly thinks connection lost == crossDomain error, both probably look the same in xhr
			if (error && error.crossDomain) {
				self._onDisconnect();
				return;
			}
			var errorSummary = 'unknown';
			if (res) {
				if (res.body) {
					if (res.body.errorCode && res.body.errorCode != 'unknown') errorSummary = res.body.errorCode;
					else if (typeof(res.body.error) == 'string') errorSummary = res.body.error.split('\n')[0];
					else errorSummary = JSON.stringify(res.body.error);
				}
				else errorSummary = res.xhr.statusText + ' ' + res.xhr.status;
			}
			var err = { errorSummary: errorSummary, error: error, res: res, errorCode: res && res.body ? res.body.errorCode : 'unknown' };
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
