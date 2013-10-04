var rc = require('rc');
var optimist = require('optimist');

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

	// Launch a browser window with ungit when ungit is started
	launchBrowser: true,

	// Instead of launching ungit with the current folder force a different path to be used. Can be set to null to force the home screen.
	forcedLaunchPath: undefined,

	// Closes the server after x ms of inactivity. Mainly used by the clicktesting.
	autoShutdownTimeout: undefined,

	// Maximum number of automatic restarts after a crash. Undefined == unlimited.
	maxNAutoRestartOnCrash: undefined,

	// Don't fast forward git mergers. See git merge --no-ff documentation
	noFFMerge: true,

	// Automatically fetch from remote when entering a repository using ungit
	autoFetch: true,

	// Used for development purposes.
	dev: false,
};

module.exports = function() {
	// Works for now but should be moved to bin/ungit
	var argv = optimist
		.usage('ungit [-b] [--cliconfigonly]')
		.alias('b', 'launchBrowser')
		.describe('b', 'Launch a browser window with ungit when the ungit server is started')
		.describe('cliconfigonly', 'Ignore the default configuration points and only use parameters sent on the command line')
		.argv;

	if (argv.help) {
	    optimist.showHelp();
	    process.exit(0);
	} else if (argv.cliconfigonly) {
		var deepExtend = require('deep-extend');
		return deepExtend.apply(null, [
    		defaultConfig,
    		argv
    	]);
	} else {
		return rc('ungit', defaultConfig, argv);
	}
}
