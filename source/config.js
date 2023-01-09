'use strict';

const rc = require('rc');
const path = require('path');
const fs = require('fs');
const yargs = require('yargs');
const homedir = require('os').homedir();
const child_process = require('child_process');
const process = require('process');
const semver = require('semver');

const isTestRun = process.argv.filter((arg) => arg.indexOf('mocha') >= 0).length > 0;

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

  // True to enable authentication. Users are defined in the users configuration property.
  authentication: false,

  // Map of username/passwords which are granted access.
  users: {},

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

  // Don't fast forward git mergers. See git merge --no-ff documentation
  noFFMerge: true,

  // Automatically fetch from remote when entering a repository using ungit, periodically on activity detection, or on directory change
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
  disableDiscardMuteTime: 60 * 1000 * 5, // 5 mins

  // Allowed number of retry for git "index.lock" conflict
  lockConflictRetryCount: 3,

  // Auto checkout the created branch on creation
  autoCheckoutOnBranchCreate: false,

  // Always load with active checkout branch (deprecated: use `maxActiveBranchSearchIteration`)
  alwaysLoadActiveBranch: false,

  // Max search iterations for active branch.  ( value means not searching for active branch)
  maxActiveBranchSearchIteration: -1,

  // number of nodes to load for each git.log call
  numberOfNodesPerLoad: 25,

  // Specifies a custom git merge tool to use when resolving conflicts. Your git configuration must be set up to use this!
  // A true value will use the default tool while a string value will use the tool of that specified name.
  mergeTool: false,

  // Preferred default diff type used. Can be `"textdiff"` or `"sidebysidediff"`.
  diffType: undefined,

  // Specify whether to Ignore or Show white space diff
  ignoreWhiteSpaceDiff: false,

  // Specify tab size as number of spaces
  tabSize: null,

  // Number of refs to show on git commit bubbles to limit too many refs to appear.
  numRefsToShow: 5,

  // Force gpg sign for tags and commits.  (additionally one can set up `git config commit.gpgsign true`
  // instead of this flag)  more on this: https://help.github.com/articles/signing-commits-using-gpg/
  isForceGPGSign: false,

  // Array of local git repo paths to display at the ungit home page
  defaultRepositories: [],

  // a string of ip to bind to, default is `127.0.0.1`
  ungitBindIp: '127.0.0.1',

  // is front end animation enabled
  isAnimate: true,

  // disable progress bar (front end api)
  isDisableProgressBar: false,

  // git binary path, not including git binary path. (i.e. /bin or /usr/bin/)
  gitBinPath: null,

  // when false, disable numstats durin status for performance.  see #1193
  isEnableNumStat: true,
};

// Works for now but should be moved to bin/ungit
const argv = yargs
  .usage('$0 [-v] [-b] [--cliconfigonly] [--gitVersionCheckOverride]')
  .example('$0 --port=8888', 'Run Ungit on port 8888')
  .example(
    '$0 --no-logRESTRequests --logGitCommands',
    'Turn off REST logging but turn on git command log'
  )
  .help('help')
  .version()
  .alias('b', 'launchBrowser')
  .boolean('launchBrowser')
  .alias('h', 'help')
  .alias('o', 'gitVersionCheckOverride')
  .boolean('gitVersionCheckOverride')
  .alias('v', 'version')
  .describe(
    'o',
    'Ignore git version check and allow ungit to run with possibly lower versions of git'
  )
  .boolean('o')
  .describe('ungitVersionCheckOverride', 'Ignore check for older version of ungit')
  .boolean('ungitVersionCheckOverride')
  .describe(
    'b',
    'Launch a browser window with ungit when the ungit server is started. --no-b or --no-launchBrowser disables this'
  )
  .boolean('b')
  .describe(
    'cliconfigonly',
    'Ignore the default configuration points and only use parameters sent on the command line'
  )
  .boolean('cliconfigonly')
  .describe('port', 'The port ungit is exposed on')
  .describe('urlBase', 'The base URL ungit will be accessible from')
  .describe('rootPath', 'The root path ungit will be accessible from')
  .describe('logDirectory', 'Directory to output log files')
  .describe('logRESTRequests', 'Write REST requests to the log')
  .boolean('logRESTRequests')
  .describe('logGitCommands', 'Write git commands issued to the log')
  .boolean('logGitCommands')
  .describe('logGitOutput', 'Write the result of git commands issued to the log')
  .boolean('logGitOutput')
  .describe('bugtracking', 'This will automatically send anonymous bug reports')
  .boolean('bugtracking')
  .describe(
    'authentication',
    'True to enable authentication. Users are defined in the users configuration property'
  )
  .boolean('authentication')
  .describe('users', 'Map of username/passwords which are granted access')
  .describe(
    'showRebaseAndMergeOnlyOnRefs',
    'Set to false to show rebase and merge on drag and drop on all nodes'
  )
  .boolean('showRebaseAndMergeOnlyOnRefs')
  .describe('maxConcurrentGitOperations', 'Maximum number of concurrent git operations')
  .describe(
    'forcedLaunchPath',
    'Define path to be used on open. Can be set to null to force the home screen'
  )
  .describe(
    'autoShutdownTimeout',
    'Closes the server after x ms of inactivity. Mainly used by the clicktesting'
  )
  .describe('noFFMerge', "Don't fast forward git mergers. See git merge --no-ff documentation")
  .boolean('noFFMerge')
  .describe(
    'autoFetch',
    'Automatically fetch from remote when entering a repository using ungit, periodically on activity detection, or on directory change'
  )
  .boolean('autoFetch')
  .describe('dev', 'Used for development purposes')
  .boolean('dev')
  .describe(
    'logLevel',
    'The logging level, possible values are none, error, warn, info, verbose, debug, and silly.'
  )
  .describe(
    'launchCommand',
    'Specify a custom command to launch. `%U` will be replaced with the URL that corresponds with the working git directory.'
  )
  .describe('allowCheckoutNodes', 'Allow checking out nodes (which results in a detached head)')
  .boolean('allowCheckoutNodes')
  .describe(
    'allowedIPs',
    'An array of ip addresses that can connect to ungit. All others are denied'
  )
  .describe(
    'autoPruneOnFetch',
    'Automatically remove remote tracking branches that have been removed on the server when fetching. (git fetch -p)'
  )
  .boolean('autoPruneOnFetch')
  .describe('pluginDirectory', 'Directory to look for plugins')
  // --pluginConfigs doesn't work...  Probably only works in .ungitrc as a json file
  .describe(
    'pluginConfigs',
    'No supported as a command line argument, use ungitrc config file.  See README.md'
  )
  .describe('autoStashAndPop', 'Used for development purposes')
  .boolean('autoStashAndPop')
  .describe('fileSeparator', 'OS dependent file separator')
  .describe('disableDiscardWarning', 'disable warning popup at discard')
  .boolean('disableDiscardWarning')
  .describe(
    'disableDiscardMuteTime',
    'duration of discard warning dialog mute time should it be muted'
  )
  .describe('lockConflictRetryCount', 'Allowed number of retry for git "index.lock" conflict')
  .describe('autoCheckoutOnBranchCreate', 'Auto checkout the created branch on creation')
  .boolean('autoCheckoutOnBranchCreate')
  .describe(
    'alwaysLoadActiveBranch',
    'Always load with active checkout branch (DEPRECATED, use `maxActiveBranchSearchIteration`)'
  )
  .boolean('alwaysLoadActiveBranch')
  .describe(
    'maxActiveBranchSearchIteration',
    'Max search iterations for active branch.  (-1 means not searching for active branch)'
  )
  .describe('numberOfNodesPerLoad', 'number of nodes to load for each git.log call')
  .describe('mergeTool', 'the git merge tool to use when resolving conflicts')
  .describe(
    'diffType',
    'Prefered default diff type used. Can be `"textdiff"` or `"sidebysidediff"`.'
  )
  .describe('ignoreWhiteSpaceDiff', 'Specify whether to Ignore or Show white space diff')
  .boolean('ignoreWhiteSpaceDiff')
  .describe(
    'numRefsToShow',
    'Number of refs to show on git commit bubbles to limit too many refs to appear.'
  )
  .describe('tabSize', 'Specify tab size as number of spaces')
  .describe('isForceGPGSign', 'Force gpg sign for tags and commits.')
  .boolean('isForceGPGSign')
  .describe(
    'defaultRepositories',
    'Array of local git repo paths to display at the ungit home page'
  )
  .describe('ungitBindIp', 'a string of ip to bind to, default is `127.0.0.1`')
  .describe('isAnimate', 'is front end animation enabled')
  .boolean('isAnimate')
  .describe('isDisableProgressBar', 'disable progress bar (front end api)')
  .boolean('isDisableProgressBar')
  .describe(
    'gitBinPath',
    'git binary path, not including git binary path. (i.e. /bin or /usr/bin/)'
  )
  .describe(
    'isEnableNumStat',
    'when false, disables numstats during git status for performance.  see #1193'
  )
  .boolean('isEnableNumStat');
const argvConfig = argv.argv;

// When ungit is started normally, $0 == ungit, and non-hyphenated options exists, show help and exit.
if (argvConfig.$0.endsWith('ungit') && argvConfig._ && argvConfig._.length > 0) {
  yargs.showHelp();
  process.exit(1);
}

let rcConfig = {};
if (!argvConfig.cliconfigonly) {
  try {
    rcConfig = rc('ungit');
    // rc return additional options that must be ignored
    delete rcConfig['config'];
    delete rcConfig['configs'];
  } catch (err) {
    console.error(`Stop at reading ~/.ungitrc because ${err}`);
    process.exit(1);
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
  value: function () {
    const alt = {};
    Object.getOwnPropertyNames(this).forEach((key) => {
      alt[key] = this[key];
    });
    return alt;
  },
  configurable: true,
});

try {
  module.exports.gitVersion = /.*?(\d+[.]\d+[.]\d+).*/.exec(
    child_process.execSync('git --version').toString()
  )[1];
} catch (e) {
  console.error(
    'Can\'t run "git --version". Is git installed and available in your path?',
    e.stderr
  );
  throw e;
}

module.exports.ungitPackageVersion = require('../package.json').version;

let devVersion = module.exports.ungitPackageVersion;
if (fs.existsSync(path.join(__dirname, '..', '.git'))) {
  const revision = child_process
    .execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') })
    .toString()
    .replace('\n', ' ')
    .trim();
  devVersion = `dev-${module.exports.ungitPackageVersion}-${revision}`;
}
module.exports.ungitDevVersion = devVersion;

if (module.exports.alwaysLoadActiveBranch) {
  module.exports.maxActiveBranchSearchIteration = 25;
}

module.exports.isGitOptionalLocks = semver.satisfies(module.exports.gitVersion, '2.15.0');

if (isTestRun) {
  console.warn('Running mocha test run, overriding few test variables...');
  module.exports.logLevel = 'debug';
  module.exports.dev = true;
}
