var rc = require('rc');

var defaultConfig = {
	
	// The port ungit is exposed on.
	port: 8448,

	// Enables gerrit integration.
	gerrit: false,

	// Directory to output log files.
	logDirectory: null,

	// Write REST requests to the log
	logRESTRequests: true,

	// Write git commands issued to the log
	logGitCommands: false,

	// Write the result of git commands issued to the log
	logGitOutput: false,

	// This will automatically send anonymous bug reports.
	bugtracking: false,

	// Google analytics for usage statistics.
	sendUsageStatistics: false,

	// True to enable authentication. Users are defined in the users configuration property.
	authentication: false,
	
	// Map of username/passwords which are granted access.
	users: undefined,

	// Ssh username. Defaults to what the repository is configured with, or the currently logged in user.
	sshUsername: undefined,

	// Ssh agent. Defaults to pageant on Windows and SSH_AUTH_SOCK on Unix.
	sshAgent: undefined,

	// Set to false to show rebase and merge on drag and drop on all nodes.
	showRebaseAndMergeOnlyOnRefs: true,

	// Maximum number of concurrent git operations
	maxConcurrentGitOperations: 4,

	// Used for development purposes.
	dev: false,
};

module.exports = function() {
	return rc('ungit', defaultConfig);
}
