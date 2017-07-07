'use strict';

const rc = require('rc');
const path = require('path');
const fs = require('fs');
const yargs = require('yargs');
const homedir = require('os-homedir')();
const winston = require('winston');
const child_process = require('child_process');

const defaultConfig = {

  // The port ungit is exposed on.
  port: 8448,

  // The base URL ungit will be accessible from.
  urlBase: 'http://localhost',

  // The URL root path under which ungit will be accesible.
  rootPath: '',

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

  // Assigns the log level. Possible values, in order from quietest to loudest, are
  // "none", "error", "warn", "info", "verbose", "debug", and "silly"
  logLevel: 'warn',

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
  pluginDirectory: path.join(homedir, '.ungit', 'plugins'),

  // Name-object pairs of configurations for plugins. To disable a plugin, use "disabled": true, for example:
  // "pluginConfigs": { "gerrit": { "disabled": true } }
  pluginConfigs: {},

  // Don't show errors when the user is using a bad or undecidable git version
  gitVersionCheckOverride: false,

  // Don't show upgrade message when the user is using an older version of ungit
  ungitVersionCheckOverride: false,

  // Automatically does stash -> operation -> stash pop when you checkout, reset or cherry pick. This makes it
  // possible to perform those actions even when you have a dirty working directory.
  autoStashAndPop: true,

  fileSeparator: path.sep,

  // disable warning popup at discard
  disableDiscardWarning: false,

  // Duration of discard warning dialog mute time should it be muted.
  disableDiscardMuteTime: 60 * 1000 * 5,  // 5 mins

  // Allowed number of retry for git "index.lock" conflict
  lockConflictRetryCount: 3,

  // Auto checkout the created branch on creation
  autoCheckoutOnBranchCreate: false,

  // Always load with active checkout branch
  alwaysLoadActiveBranch: false,

  // number of nodes to load for each git.log call
  numberOfNodesPerLoad: 25,

  // Specifies a custom git merge tool to use when resolving conflicts. Your git configuration must be set up to use this!
  // A true value will use the default tool while a string value will use the tool of that specified name.
  mergeTool: false,

  // Prefered default diff type used. Can be `"textdiff"` or `"sidebysidediff"`.
	diffType: undefined,
};

// Works for now but should be moved to bin/ungit
let argv = yargs
.usage('$0 [-v] [-b] [--cliconfigonly] [--gitVersionCheckOverride]')
.example('$0 --port=8888', 'Run Ungit on port 8888')
.example('$0 --no-logRESTRequests --logGitCommands', 'Turn off REST logging but turn on git command log')
.help('help')
.version()
.alias('b', 'launchBrowser')
.alias('h', 'help')
.alias('o', 'gitVersionCheckOverride')
.alias('v', 'version')
.describe('o', 'Ignore git version check and allow ungit to run with possibly lower versions of git')
.describe('ungitVersionCheckOverride', 'Ignore check for older version of ungit')
.describe('b', 'Launch a browser window with ungit when the ungit server is started. --no-b or --no-launchBrowser disables this')
.describe('cliconfigonly', 'Ignore the default configuration points and only use parameters sent on the command line')
.boolean('cliconfigonly')
.describe('port', 'The port ungit is exposed on')
.describe('urlBase', 'The base URL ungit will be accessible from')
.describe('rootPath', 'The root path ungit will be accessible from')
.describe('logDirectory', 'Directory to output log files')
.describe('logRESTRequests', 'Write REST requests to the log')
.describe('logGitCommands', 'Write git commands issued to the log')
.describe('logGitOutput', 'Write the result of git commands issued to the log')
.describe('bugtracking', 'This will automatically send anonymous bug reports')
.describe('sendUsageStatistics', 'Google analytics for usage statistics')
.describe('authentication', 'True to enable authentication. Users are defined in the users configuration property')
.describe('users', 'Map of username/passwords which are granted access')
.describe('showRebaseAndMergeOnlyOnRefs', 'Set to false to show rebase and merge on drag and drop on all nodes')
.describe('maxConcurrentGitOperations', 'Maximum number of concurrent git operations')
.describe('forcedLaunchPath', 'Define path to be used on open. Can be set to null to force the home screen')
.describe('autoShutdownTimeout', 'Closes the server after x ms of inactivity. Mainly used by the clicktesting')
.describe('maxNAutoRestartOnCrash', 'Maximum number of automatic restarts after a crash. Undefined == unlimited')
.describe('noFFMerge', 'Don\'t fast forward git mergers. See git merge --no-ff documentation')
.describe('autoFetch', 'Automatically fetch from remote when entering a repository using ungit')
.describe('dev', 'Used for development purposes')
.describe('logLevel', 'The logging level, possible values are none, error, warn, info, verbose, debug, and silly.')
.describe('launchCommand', 'Specify a custom command to launch. `%U` will be replaced with the URL that corresponds with the working git directory.')
.describe('allowCheckoutNodes', 'Allow checking out nodes (which results in a detached head)')
.describe('allowedIPs', 'An array of ip addresses that can connect to ungit. All others are denied')
.describe('autoPruneOnFetch', 'Automatically remove remote tracking branches that have been removed on the server when fetching. (git fetch -p)')
.describe('pluginDirectory', 'Directory to look for plugins')
// --pluginConfigs doesn't work...  Probably only works in .ungitrc as a json file
.describe('pluginConfigs', 'No supported as a command line argument, use ungitrc config file.  See README.md')
.describe('autoStashAndPop', 'Used for development purposes')
.describe('dev', 'Automatically does stash -> operation -> stash pop when you checkout, reset or cherry pick')
.describe('fileSeparator', 'OS dependent file separator')
.describe('disableDiscardWarning', 'disable warning popup at discard')
.describe('disableDiscardMuteTime', 'duration of discard warning dialog mute time should it be muted')
.describe('lockConflictRetryCount', 'Allowed number of retry for git "index.lock" conflict')
.describe('autoCheckoutOnBranchCreate', 'Auto checkout the created branch on creation')
.describe('alwaysLoadActiveBranch', 'Always load with active checkout branch')
.describe('numberOfNodesPerLoad', 'number of nodes to load for each git.log call')
.describe('mergeTool', 'the git merge tool to use when resolving conflicts')
.describe('diffType', 'Prefered default diff type used. Can be `"textdiff"` or `"sidebysidediff"`.')
;

var argvConfig = argv.argv;

// For testing, $0 is grunt.  For credential-parser test, $0 is node
// When ungit is started normaly, $0 == ungit, and non-hyphenated options exists, show help and exit.
if (argvConfig.$0.indexOf('ungit') > -1 && argvConfig._ && argvConfig._.length > 0) {
  yargs.showHelp();
  process.exit(0);
}

var rcConfig = {};
if (!argvConfig.cliconfigonly) {
  try {
    rcConfig = rc('ungit');
    // rc return additional options that must be ignored
    delete rcConfig['config'];
    delete rcConfig['configs'];
  } catch (err) {
    winston.error(`Stop at reading ~/.ungitrc because ${err}`);
    process.exit(0);
  }
}

module.exports = argv.default(defaultConfig).default(rcConfig).argv;

module.exports.homedir = homedir;

let currentRootPath = module.exports.rootPath;
if (typeof currentRootPath !== 'string') {
  currentRootPath = '';
} else if (currentRootPath !== '') {
  // must start with a slash
  if (currentRootPath.charAt(0) !== '/') {
    currentRootPath = '/' + currentRootPath;
  }
  // can not end with a trailing slash
  if (currentRootPath.charAt(currentRootPath.length - 1) === '/') {
    currentRootPath = currentRootPath.substring(0, currentRootPath.length - 1);
  }
}
module.exports.rootPath = currentRootPath;

// Errors can not be serialized with JSON.stringify without this fix
// http://stackoverflow.com/a/18391400
Object.defineProperty(Error.prototype, 'toJSON', {
  value: function() {
    let alt = {};
    Object.getOwnPropertyNames(this).forEach(key => {
      alt[key] = this[key];
    });
    return alt;
  },
  configurable: true
});

try {
  module.exports.gitVersion = /.*?(\d+[.]\d+[.]\d+).*/.exec(child_process.execSync('git --version').toString())[1];
} catch (e) {
  winston.error('Can\'t run "git --version". Is git installed and available in your path?', e.stderr);
  throw e;
}

module.exports.ungitPackageVersion = require('../package.json').version;

if (fs.existsSync(path.join(__dirname, '..', '.git'))){
  const revision = child_process.execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') })
    .toString()
    .replace('\n', ' ')
    .trim();
  module.exports.ungitDevVersion = `dev-${module.exports.ungitPackageVersion}-${revision}`;
} else {
  module.exports.ungitDevVersion = module.exports.ungitPackageVersion;
}
