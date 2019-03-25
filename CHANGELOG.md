# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).
Use the following format for additions: ` - VERSION: [feature/patch (if applicable)] Short description of change. Links to relevant issues/PRs.`

- 1.4.43:
  - fix gitignore manual edit not being saved [644](https://github.com/FredrikNoren/ungit/issues/644)
  - fix issue with detached git processes on some OS and timeout not being enforced.
  - simplify `maxSearchIteration` enforcement for git.log()
  - change `alwaysLoadActiveBranch` boolean config to `maxActiveBranchSearchIteration` numeric config
  - bumped node engine requirement to [10.14 Dubnium](https://github.com/nodejs/node/blob/master/doc/changelogs/CHANGELOG_V10.md#10.14.2)
- 1.4.42: Add "Ignore white space" config [#1185](https://github.com/FredrikNoren/ungit/pull/1185)
- 1.4.41: Remove Google Analytics [#1182](https://github.com/FredrikNoren/ungit/pull/1182)
- 1.4.40: Remove Keen.io [#1180](https://github.com/FredrikNoren/ungit/pull/1180)
- 1.4.39: Add git bin path config. [#1151](https://github.com/FredrikNoren/ungit/issues/1151)
- 1.4.38: Fix: Highlight current branch in submodules
- 1.4.37: Sort modules by names
- 1.4.36: fix changing remotes in remotes dropdown [#1158](https://github.com/FredrikNoren/ungit/pull/1158)
- 1.4.35:
  - allow disabling of nprogress bar [#1143](https://github.com/FredrikNoren/ungit/issues/1143)
  - set `ungitVersionCheckOverride` as boolean in config [#1102](https://github.com/FredrikNoren/ungit/issues/1102)
- 1.4.34: fix issues when remote tags doesn't show [#1139](https://github.com/FredrikNoren/ungit/issues/1139)
- 1.4.33:
  - Bump getmac version [#1130](https://github.com/FredrikNoren/ungit/issues/1130)
  - Add config to disable animation [#1136](https://github.com/FredrikNoren/ungit/issues/1136)
  - dependency bumps
  - Remove node6. Add node8 and node9 explicitly.
- 1.4.32:
  - Handle crashes with better logs
  - Wrap localStorage to support environments without access to it
- 1.4.31: Add error logging for npm publish
- 1.4.30: Add `ungitBindIp` config to allow default binding in some cases [#1112](https://github.com/FredrikNoren/ungit/issues/1112)
- 1.4.29:
  - Add `--no-optional-locks` if git version is appropriate [#1105](https://github.com/FredrikNoren/ungit/issues/1105)
  - Ensure ungit server to bind to `127.0.0.1` [#988](https://github.com/FredrikNoren/ungit/issues/988)
  - Add node highlight on mouse hover on relationsip path [#1093](https://github.com/FredrikNoren/ungit/issues/1093)
- 1.4.28: adding raven locally for offline access. [#1107](https://github.com/FredrikNoren/ungit/pull/1107)
- 1.4.27: logic change for the merge conflict resolution
- 1.4.26: add a way to preconfigure repo lists [#1106](https://github.com/FredrikNoren/ungit/issues/1106)
- 1.4.25: add git pgp signing docs and code [#740](https://github.com/FredrikNoren/ungit/issues/740)
- 1.4.24:
  - change `/api/log` -> `/api/gitlog` as soem ad blockers really hates This
  - Fix excessive error messaging when disconnected from internet
  - Fix Raven initialization error when disconnected from internet
- 1.4.23:
  - add feature to do `--recurse-submodules` for git clone [#1080](https://www.gnupg.org/documentation/manpage.html
  - increase debounce 250->500 wait and 1000->2000 sec so UI can pick up server changes more accurately
- 1.4.22: Fix missing jQuery and jQuery UI references [#1086](https://github.com/FredrikNoren/ungit/issues/1086)
- 1.4.21: Treat remote fetch fail as an warning rather than error [#1081](https://github.com/FredrikNoren/ungit/issues/1081)
- 1.4.20:
  - deleted checked in 3rd party codes and manage by npm.
  - remove dependencies on async lib
- 1.4.19:
  - fix credential helper not fetching all the authentication data [#1078](https://github.com/FredrikNoren/ungit/pull/1078)
- 1.4.18:
  - fix inaccurate git state issue when new branch name conflict and `autoCheckoutOnBranchCreate` is enabled.
  - Add content refresh on .gitignore file change
  - fix reference filtering
- 1.4.17: fix textarea with in dialog when editing .gitignore [#1068](https://github.com/FredrikNoren/ungit/pull/1068)
- 1.4.16: Move version number to below logo. [#1069](https://github.com/FredrikNoren/ungit/pull/1069)
- 1.4.15: fix not setting `pathToNavigateTo` properly when `launchBrowser` is false and `launchCommand` is set [#1065](https://github.com/FredrikNoren/ungit/issues/1065)
- 1.4.14: fix credential helper when ungit is used with rootpath [#1060](https://github.com/FredrikNoren/ungit/issues/1060)
- 1.4.13:
  - Change raven web client source to CDN rather than local copy [#972](https://github.com/FredrikNoren/ungit/issues/972)
  - dependency bump
- 1.4.12:
  - Adding internet disconnected state handling [#1014](https://github.com/FredrikNoren/ungit/issues/1014)
  - Allow editing .gitignore via ungit [#976](https://github.com/FredrikNoren/ungit/issues/1014)
- 1.4.11:
  - differentiate remote vs local tag. [#1016](https://github.com/FredrikNoren/ungit/issues/1016)
  - fix push not throwing giterror
  - fix remote tag push not creating remote tag
  - change ref refresh logic
  - show error on incorrect credentials [#1042](https://github.com/FredrikNoren/ungit/pull/1042)
  - allow credential handling for remotes [#1039](https://github.com/FredrikNoren/ungit/issues/1039)
  - add cancel button for empty commits and amends [#1029](https://github.com/FredrikNoren/ungit/issues/1029)
  - cleanup clicktest output [#1035](https://github.com/FredrikNoren/ungit/pull/1035)
- 1.4.10:
  - hide / disable push option if there is no remote [#1050](https://github.com/FredrikNoren/ungit/issues/1050)
  - add commit & push option [#1038](https://github.com/FredrikNoren/ungit/issues/1038)
- 1.4.9:
  - handle failed promises [#1017](https://github.com/FredrikNoren/ungit/issues/1017)
  - empty commit [#1028](https://github.com/FredrikNoren/ungit/issues/1028)
  - fix commit detail layout while hovering over commit node [#1025](https://github.com/FredrikNoren/ungit/issues/1025)
- 1.4.8: fix remote branches display name and delete action [#1032](https://github.com/FredrikNoren/ungit/issues/1032), [#1031](https://github.com/FredrikNoren/ungit/issues/1031)
- 1.4.7: add remote branches to the branch list. [#966](https://github.com/FredrikNoren/ungit/issues/966)
- 1.4.6:
  - dependency bump to fix dependency's security problem.
  - Add emphasis if remote branch delete for confirmation dialog. [#947](https://github.com/FredrikNoren/ungit/issues/947)
- 1.4.5: fix a bug where no diff wasn't properly showing [#969](https://github.com/FredrikNoren/ungit/issues/969)
- 1.4.4:
  - fix a bug where fetch is disabled after page load
  - make `forceLaunchPath` to supersede `launchBrowser` [#1006](https://github.com/FredrikNoren/ungit/issues/1006)
- 1.4.3: changing to path navigation to `nprogress` bar. [#1001](https://github.com/FredrikNoren/ungit/issues/1001)
- 1.4.2:
  - fix navigation redirection on git clone and adding xkcd image
  - dependency bump
- 1.4.1:
  - fix the issue where browser opens before ungit start. [#994](https://github.com/FredrikNoren/ungit/issues/994)
  - including xkcd art back [#999](https://github.com/FredrikNoren/ungit/issues/999)
- 1.4.0: Revert to MIT [#947](https://github.com/FredrikNoren/ungit/issues/974)
- 1.3.3: fix `tagsToDisplay` clearing issue. [#973](https://github.com/FredrikNoren/ungit/issues/973)
- 1.3.2: Adding in ref search box and limit num of ref display [#973](https://github.com/FredrikNoren/ungit/issues/973)
- 1.3.1: Add link to plans & license in header [#947](https://github.com/FredrikNoren/ungit/issues/974)
- 1.3.0: Switch to Faircode paywall instead of license popup [#947](https://github.com/FredrikNoren/ungit/issues/974)
- 1.2.3: Bump license text to v0.2.1 (fixes typo). [Faircode License changelog](https://github.com/faircodeio/faircode-license/blob/master/CHANGELOG.md)
- 1.2.2: Bump license text to v0.2 to fix two small inconsistencies: Clarify currency (USD) and remove "no additional rights" clause as it's problematic and superfluous. License changelog at https://github.com/faircodeio/faircode-license/blob/master/CHANGELOG.md [#947](https://github.com/FredrikNoren/ungit/issues/974)
- 1.2.1: fix for not launching browser when executed at the git repo [#986](https://github.com/FredrikNoren/ungit/issues/986)
- 1.2.0:
  - Show license notification on first start (license changed in 1.1.32) [#947](https://github.com/FredrikNoren/ungit/issues/974)
  - fix potential memory leak with `express-session`[#977](https://github.com/FredrikNoren/ungit/issues/977)
  - Fix document title on windows [#983](https://github.com/FredrikNoren/ungit/pull/983)
  - parse local storage as json instead of regex [#981](https://github.com/FredrikNoren/ungit/pull/981)
  - resolve path keywords such as `~` at server side [#980](https://github.com/FredrikNoren/ungit/issues/975)
- 1.1.33:
  - Make Logo and favicon HiDpi [#589](https://github.com/FredrikNoren/ungit/issues/589)
  - Remove forever-monitor [#961](https://github.com/FredrikNoren/ungit/issues/961)
- 1.1.32: Update license [#974](https://github.com/FredrikNoren/ungit/issues/974)
- 1.1.31: Bump dependencies
- 1.1.30:
  - move unit tests to es6
  - Add squash feature [#129](https://github.com/FredrikNoren/ungit/issues/129)
- 1.1.29: move `Gruntfile.js` to es6
- 1.1.28: please append your changes to here instead of new version.
  - Refactoring to remove static data-ta tags from tests
  - `grunt nmclicktest` -> `grunt clicktest`
  - Stabilize ungit open test of clicktest via using a tag that is guaranteed to be generated
  - Add click test bailout on tes failure
  - Add parallel click test `grunt clickParallel`
  - Remove deps to fix config init bug for the `credentials-helper`. [#838](https://github.com/FredrikNoren/ungit/issues/838)
- 1.1.27: Add alert when moving back in time. [#914](https://github.com/FredrikNoren/ungit/issues/914)
- 1.1.26:
  - fix invalid path input for autocomplete causing front end crash [#942](https://github.com/FredrikNoren/ungit/issues/942)
  - bump and checking in package-lock.json
- 1.1.25: Change stash pop operation to stash apply [#919](https://github.com/FredrikNoren/ungit/issues/919)
- 1.1.24: fix some commands not properly reporting git error [#933](https://github.com/FredrikNoren/ungit/issues/933)
- 1.1.23: finalize nightmare click test
- 1.1.22: Add a config setting to allow setting the default diff type. [#929](https://github.com/FredrikNoren/ungit/issues/929)
- 1.1.21:
  - Initial refactoring of click test using nightmare and mocha
  - **Dropping support for node 4.x and 5.x!, 6.x and later is now supported.**
- 1.1.20: Hide credentials in remote urls at home repo list
- 1.1.19: Ask before deleting a stash
- 1.1.18: Fix checking out remote refs (again)
- 1.1.17: Fix checking out remote refs
- 1.1.16:
  - clicktests logging correction and using wait for within tests.
  - Refactor filewatch and using normalized test path
  - throttle parallel test's parellelization limit
  - dependency bump
  - Fix context issue for `gitSetUserConfig` [#912](https://github.com/FredrikNoren/ungit/issues/912)
- 1.1.15: Updating crash page with instructions and adblock detection
- 1.1.14: Disable strict mode for startup params and config [#890](https://github.com/FredrikNoren/ungit/issues/890)
- 1.1.13: Fix startup args bug: [#896](https://github.com/FredrikNoren/ungit/issues/896)
- 1.1.12:
  - Retain commit messages when commit fails [#882](https://github.com/FredrikNoren/ungit/pull/882)
  - Fix rare edge case where remote node is gone during reset op.
  - rescursively resolve all promises before caching them. [#878](https://github.com/FredrikNoren/ungit/pull/878)
- 1.1.11:
    - Fix cli arguments [#871](https://github.com/FredrikNoren/ungit/pull/871)
    - Stop if ~/.ungitrc contains syntax error
    - Removed official support ini format of ~/.ungitrc, because internal API supports only JSON
- 1.1.10: Fix broken diff out in some cases when diff contains table. [#881](https://github.com/FredrikNoren/ungit/pull/881)
- 1.1.9: Fix around ubuntu's inability to cache promises. [#877](https://github.com/FredrikNoren/ungit/pull/878)
- 1.1.8:
    - Realtime text diff via invalidate diff on directory change [#867](https://github.com/FredrikNoren/ungit/pull/867)
    - Promisify `./source/utils/cache.js` [#870](https://github.com/FredrikNoren/ungit/pull/870)
    - Fix load more text diff button. [#876](https://github.com/FredrikNoren/ungit/pull/876)
- 1.1.7:
    - Fix diff flickering issue and optimization [#865](https://github.com/FredrikNoren/ungit/pull/865)
    - Fix credential dialog issue [#864](https://github.com/FredrikNoren/ungit/pull/864)
    - Fix HEAD branch order when redraw [#858](https://github.com/FredrikNoren/ungit/issues/858)
- 1.1.6: Fix path auto complete [#861](https://github.com/FredrikNoren/ungit/issues/861)
- 1.1.5: Update "Toggle all" button after commit or changing selected files [#859](https://github.com/FredrikNoren/ungit/issues/859)
- 1.1.4: [patch] Promise refactoring
- 1.1.3: [patch] Fix submodule navigation on windows [#577](https://github.com/FredrikNoren/ungit/issues/577)
- 1.1.2: Fix a bug that prevented the new version dialog from being dismissed
- 1.1.1: [patch] Fixed small spelling error for ignore whitespace feature [#853](https://github.com/FredrikNoren/ungit/pull/853)
- 1.1.0: Added option to ignore ungit version checks [#851](https://github.com/FredrikNoren/ungit/issues/851)
- 1.0.1: [patch] Fixed gravatar avatar fetch if email have different cases applied. [#847](https://github.com/FredrikNoren/ungit/issues/847)
- 1.0.0: Introduced Continuous delivery. [#823](https://github.com/FredrikNoren/ungit/issues/823)

## [1.0.0](https://github.com/FredrikNoren/ungit/compare/v0.10.3...v1.0.0)

### Added
- Added search by git folder name in the search bar. [#793](https://github.com/FredrikNoren/ungit/issues/793)
- New configuration option `logLevel` allows you to assign the level of logging you want to see in the servers output console.
- New configuration option `mergeTool` allows you to assign a custom external merge tool for conflict resolution [#783](https://github.com/FredrikNoren/ungit/issues/783) [Doc](https://github.com/FredrikNoren/ungit/blob/master/MERGETOOL.md)
- Whitespace ignore option for text diffs [#777](https://github.com/FredrikNoren/ungit/issues/777)
- Fix for favorites linking in case rootPath is used @sebastianmay [#609](https://github.com/FredrikNoren/ungit/issues/609) and image diffing
- Limit commit title to 72 characters, the rest is truncated and shown when inspecting the commit
- Updated file watch logic to closely follow git commands in another process [#283](https://github.com/FredrikNoren/ungit/issues/283)

### Fixed
- File diff firing increasing number of events longer it survives.
- Fix missing ungit logo. [#812](https://github.com/FredrikNoren/ungit/issues/812)
- Fix when stash output is empty [#818](https://github.com/FredrikNoren/ungit/issues/818)
- Fix minor display error for wide git repo [#830](https://github.com/FredrikNoren/ungit/pull/830)
- Persist commit messages during merge operation [#779](https://github.com/FredrikNoren/ungit/issues/779)
- Refresh `staging.files` object for cleaner refresh such as refresh pached line list, diff and etc.
- Fixed an issue where patching on some key word file names such as "test".
- Fix missing commit message body if commit was committed with Visual Studio or Visual Studio Code [#826](https://github.com/FredrikNoren/ungit/pull/826)
- Fix initial page load when loaded node does not fits in screen. [#832](https://github.com/FredrikNoren/ungit/issues/832)

## [0.10.3](https://github.com/FredrikNoren/ungit/compare/v0.10.2...v0.10.3)

### Added
- Show diffs for stashed changes [#444](https://github.com/FredrikNoren/ungit/issues/444)
- Active node focused git log result [#420](https://github.com/FredrikNoren/ungit/issues/420)

### Fixed
- Missing npm as a normal dependency [#766](https://github.com/FredrikNoren/ungit/issues/766)

## [0.10.2](https://github.com/FredrikNoren/ungit/compare/v0.10.1...v0.10.2)

# Fixed
- Handle SIGTERM and SIGINT [#763](https://github.com/FredrikNoren/ungit/issues/763)

### Added
- Added bare repo support [#177](https://github.com/FredrikNoren/ungit/issues/177) [#728](https://github.com/FredrikNoren/ungit/issues/728)
- Added support for cherry-pick conflict[#701](https://github.com/FredrikNoren/ungit/issues/701)
- Added wordwrap support for diffs [#721](https://github.com/FredrikNoren/ungit/issues/721)
- Support for Node6 [#745](https://github.com/FredrikNoren/ungit/pull/745/files)
- Added "autoCheckoutOnBranchCreate" option [#752](https://github.com/FredrikNoren/ungit/pull/752/files)

### Fixed
- Fix maxConcurrentGitOperations not limiting git processes [#707](https://github.com/FredrikNoren/ungit/issues/707)
- Fix ".lock" file conflicts in parallelized git operations [#515](https://github.com/FredrikNoren/ungit/issues/515)
- Allow Ungit to function under sub dir of a git dir [#734](https://github.com/FredrikNoren/ungit/issues/734)
- Removed deprecated npmconf package [#746](https://github.com/FredrikNoren/ungit/issues/746)
- More helpful warning messages [#749](https://github.com/FredrikNoren/ungit/pull/749/files)
- Deleting already deleted remote tag [#748](https://github.com/FredrikNoren/ungit/pull/748)
- Fix to handle revert merge commit [#757](https://github.com/FredrikNoren/ungit/pull/757)

### Changed
- Cleaner rebase conflict message display [#708](https://github.com/FredrikNoren/ungit/pull/708)
- ES6 [#672](https://github.com/FredrikNoren/ungit/pull/672)
- Dropped support for Node 0.10 and 0.12 [#745](https://github.com/FredrikNoren/ungit/pull/745/files)

## [0.10.1](https://github.com/FredrikNoren/ungit/compare/v0.10.0...v0.10.1)

### Added
- Introduced change log! [#687](https://github.com/FredrikNoren/ungit/issues/687)
- Improved server and client error logging [#695](https://github.com/FredrikNoren/ungit/pull/695)

### Fixed
- Fix crashes due to submodule parsing [#690](https://github.com/FredrikNoren/ungit/issues/690) [#689](https://github.com/FredrikNoren/ungit/issues/689)
- Fix duplicate remote tag issues [#685](https://github.com/FredrikNoren/ungit/issues/685)
- Fix scrolling issue in safari [#686](https://github.com/FredrikNoren/ungit/issues/686)
- Fix git hooks failing on non-ascii files [#676](https://github.com/FredrikNoren/ungit/issues/676)

### Removed
- Reverted on hover button effects [#688](https://github.com/FredrikNoren/ungit/issues/688)

### Changed
- Upgrade keen.io client code [#679](https://github.com/FredrikNoren/ungit/issues/679)
