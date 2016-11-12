# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/) and
[Keep a changlelog's changelog standard](http://keepachangelog.com/)

## [Unreleased](https://github.com/FredrikNoren/ungit/compare/v0.10.3...master)

### Added
- Added search by git folder name in the search bar. [#793](https://github.com/FredrikNoren/ungit/issues/793)
- New configuration option `logLevel` allows you to assign the level of logging you want to see in the servers output console.
- New configuration option `mergeTool` allows you to assign a custom external merge tool for conflict resolution [#783](https://github.com/FredrikNoren/ungit/issues/783) [Doc](https://github.com/FredrikNoren/ungit/blob/master/MERGETOOL.md)
- Whitespace ignore option for text diffs [#777](https://github.com/FredrikNoren/ungit/issues/777)
- Fix for favorites linking in case rootPath is used @sebastianmay [#609](https://github.com/FredrikNoren/ungit/issues/609) and image diffing
- Limit commit title to 72 characters, the rest is truncated and shown when inspecting the commit

### Fixed
- File diff firing increasing number of events longer it survives.
- Fix missing ungit logo. [#812](https://github.com/FredrikNoren/ungit/issues/812)

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
