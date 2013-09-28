
var signals = require('signals');
var superagent = require('../vendor/js/superagent');


var Api = function(app) {
	var self = this;
	this.app = app;
}

module.exports = Api;

Api.prototype.query = function(method, path, body, callback) {
	var self = this;
	var q = superagent(method, '/api' + path);
	if (method == 'GET' || method == 'DELETE') q.query(body);
	else q.send(body);
	if (method != 'GET') {
		self.app.workingTreeChanged.block();
		self.app.gitDirectoryChanged.block();
	}
	q.set('Accept', 'application/json');
	q.end(function(error, res) {
		if (method != 'GET') {
		self.app.workingTreeChanged.unblock();
		self.app.gitDirectoryChanged.unblock();
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