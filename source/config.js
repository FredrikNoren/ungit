
var rc = require('rc');

var defaultConfig = {
	
	// The port ungit is exposed on
	port: 8448,

	// Enables gerrit integration
	gerritIntegration: false,

	// This will automatically send anonymous bug reports
	bugtracking: true,

	// Used for development purposes
	dev: false,
};

module.exports = function() {
	return rc('ungit', defaultConfig);
}