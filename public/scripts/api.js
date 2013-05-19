
var api = {
	query: function(method, path, body, callback) {
		var q = superagent(method, '/api' + path);
		if (method == 'GET')
			q.query(body);
		else
			q.send(body);
		q.set('Accept', 'application/json')
			.end(function(error, res){
				if (error || !res.ok) {
					if (callback && callback({ error: error, res: res, errorCode: res.body.errorCode })) return;
					else viewModel.content(new CrashViewModel());
				}
				else if (callback)
					callback(null, res.body);
			});
	},
	watchRepository: function(repositoryPath, callbacks) {
		var socket = io.connect('http://localhost:3000');
		socket.emit('watch', { path: repositoryPath });
		socket.on('ready', function (data) {
			if (callbacks.ready) callbacks.ready();
		});
		socket.on('changed', function (data) {
			if (callbacks.changed) callbacks.changed();
		});
	}
}