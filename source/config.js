
var rc = require('rc');

var defaultConfig = {
	
	// The port ungit is exposed on
	port: 8448,

	// Enables gerrit integration
	gerrit: false,

	// This will automatically send anonymous bug reports
	bugtracking: true,

	// True to enable authentication. Users are defined in the users configuration property.
	authentication: false,
	
	// Map of username/passwords which are granted access.
	users: undefined,

	// Used for development purposes
	dev: false,
};

module.exports = function() {
	return rc('ungit', defaultConfig);
}