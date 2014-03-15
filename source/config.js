var rc = require('rc');
var optimist = require('optimist');
var path = require('path');

var defaultConfig = {

  // The port ungit is exposed on.
  port: 8448,

  // The base URL ungit will be accessible from.
  urlBase: "http://localhost",

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

  // Specify a custom command to launch. `%U` will be replaced with the URL
  //  that corresponds with the working git directory.
  //
  // NOTE: This will execute *before* opening the browser window if the
  //        `launchBrowser` option is `true`.
  // Example:
  //     # Override the browser launch command; use chrome's "app"
  //     #   argument to get a new, chromeless window for that "native feel"
  //     $ ungit --launchBrowser=0 --launchCommand "chrome --app=%U"
  launchCommand: undefined,

  // Allow checking out nodes (which results in a detached head)
  allowCheckoutNodes: false,

  // An array of ip addresses that can connect to ungit. All others are denied.
  // null indicates all IPs are allowed.
  // Example (only allow localhost): allowedIPs: ["127.0.0.1"]
  allowedIPs: null,

  // Automatically remove remote tracking branches that have been removed on the
  // server when fetching. (git fetch -p)
  autoPruneOnFetch: true,

  // Directory to look for plugins
  pluginDirectory: path.join(getUserHome(), '.ungit', 'plugins'),

  // Name-object pairs of configurations for plugins. To disable a plugin, use "disabled": true, for example:
  // "pluginConfigs": { "gerrit": { "disabled": true } }
  pluginConfigs: {},

  // Git version check override
  gitVersionCheckOverride: false
};

function getUserHome() {
  return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}

// Works for now but should be moved to bin/ungit
var argv = optimist
  .usage('ungit [-b] [--cliconfigonly]')
  .alias('b', 'launchBrowser')
  .describe('b', 'Launch a browser window with ungit when the ungit server is started. --no-b or --no-launchBrowser disables this.')
  .describe('cliconfigonly', 'Ignore the default configuration points and only use parameters sent on the command line')
  .argv;

if (argv.help) {
  optimist.showHelp();
  process.exit(0);
} else if (argv.cliconfigonly) {
  var deepExtend = require('deep-extend');
  module.exports = deepExtend.apply(null, [
    defaultConfig,
    argv
  ]);
} else {
  module.exports = rc('ungit', defaultConfig, argv);
}
