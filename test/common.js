
var restGit = require('../git-api');


exports.wrapErrorHandler = function(done, callback) {
	return function(err, res) {
		if (err) {
			console.dir(err);
			console.dir(res.body);
			done(err, res);
		} else if (callback) {
			callback(err, res);
		} else {
			done(err, res);
		}
	}
}

exports.get = function(req, path, payload, done, callback) {
	var r = req
		.get(restGit.pathPrefix + path);
	if (payload !== undefined)
		r.query(payload);
	r
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(200)
		.end(exports.wrapErrorHandler(done, callback || done));
}

exports.post = function(req, path, payload, done, callback) {
	var r = req
		.post(restGit.pathPrefix + path);
	if (payload !== undefined)
		r.send(payload);
	r
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(200)
		.end(exports.wrapErrorHandler(done, callback || done));
}