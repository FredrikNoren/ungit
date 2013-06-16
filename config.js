
var rc = require('rc');

module.exports = function() {
	return rc('ungit', {
		port: 8448,
		gerritIntegration: false,
		dev: false,
		bugtracking: true
	});
}