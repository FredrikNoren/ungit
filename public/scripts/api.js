
var api = {
	query: function(method, path, body, callback) {
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
					if (config.bugtracking)
						bugsense.addExtraData('data', JSON.stringify(err));
					throw new Error('Backend: ' + path + ', ' + errorSummary);
				}
			}
			else if (callback)
				callback(null, res.body);
		});
	},
	watchRepository: function(repositoryPath, callbacks) {
		var self = this;
		var socket = io.connect();
		socket.on('error', function(err) {
			throw new Error('Socket error: ' + err.toString());
		});
		socket.on('disconnect', function(data) {
			callbacks.disconnect();
		});
		socket.on('socketId', function (data) {
			self.socketId = data;
		});
		socket.emit('watch', { path: repositoryPath });
		socket.on('ready', function (data) {
			if (callbacks.ready) callbacks.ready();
		});
		socket.on('changed', function (data) {
			if (callbacks.changed) callbacks.changed();
		});
		socket.on('request-credentials', function (data) {
			if (callbacks.requestCredentials) {
				callbacks.requestCredentials(function(credentials) {
					socket.emit('credentials', credentials);
				});
			}
		});
	}
}