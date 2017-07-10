ungit
======
[![NPM version](https://badge.fury.io/js/ungit.svg)](http://badge.fury.io/js/ungit)
[![Build Status](https://travis-ci.org/FredrikNoren/ungit.svg)](https://travis-ci.org/FredrikNoren/ungit)
[![Join the chat at https://gitter.im/FredrikNoren/ungit](https://badges.gitter.im/FredrikNoren/ungit.svg)](https://gitter.im/FredrikNoren/ungit?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

The easiest way to use git. On any platform. Anywhere.

[![xkcd](xkcd.png)](https://xkcd.com/1597/)

Git is known for being a versatile distributed source control system that is a staple of many individuals, communities, and even for [the City of Chattanooga to crowd source bicycle parking locations](https://github.com/cityofchattanooga/Bicycle-Parking).  However, it is not known for userfriendlyness or easy learning curve.

Ungit brings user friendliness to git without sacrificing the versatility of git.

 * Clean and intuitive UI that makes it easy to _understand_ git.
 * Runs on any platform that node.js & git supports.
 * Web-based, meaning you can run it on your cloud/pure shell machine and use the ui from your browser (just browse to http://your-cloud-machine.com:8448).
 * Works well with GitHub.
 * [Gerrit](https://code.google.com/p/gerrit/) integration through plugin: https://github.com/FredrikNoren/ungit-gerrit

[Follow @ungitui on twitter](https://twitter.com/ungitui)

Quick intro to ungit: [http://youtu.be/hkBVAi3oKvo](http://youtu.be/hkBVAi3oKvo)

[![Screenshot](screenshot.png)](http://youtu.be/hkBVAi3oKvo)

Installing
----------
Requires [node.js](http://nodejs.org) (≥ 6.11), [npm](https://www.npmjs.com/) (≥ 3.10.10, comes with node.js) and [git](http://git-scm.com/) (≥ 1.8.x). To install ungit just type:

	npm install -g ungit

NOTE: If your system requires root access to install global npm packages, make sure you use the -H flag:

	sudo -H npm install -g ungit

Using
-----
Anywhere you want to start, just type:

	ungit

This will launch the server and open up a browser with the ui.

Configuring
---------
Put a configuration file called .ungitrc in your home directory (`/home/USERNAME` on \*nix, `C:/Users/USERNAME/` on windows). Configuration file must be in json format. See [source/config.js](source/config.js) for available options.

You can also override configuration variables at launch by specifying them as command line arguments; `ungit --port=8080`. To disable boolean features use --no: `ungit --no-autoFetch`.

Example of `~/.ungitrc` configuration file to change default port and enable bugtracking:

```json
{
	"port": 8080,
	"bugtracking": true
}
```

External Merge Tools
--------------------
If you have your own merge tool that you would like to use, such as Kaleidoscope or p4merge, you can configure ungit to use it. See [MERGETOOL.md](MERGETOOL.md).

Auto Refresh
------------
Ungit will watch git directory recursively upon page view and automatically refresh contents on git operations or changes on files that are not configured to be ignored in `.gitignore`.

One caveat is that node's [`fs.watch()`](https://nodejs.org/docs/latest/api/fs.html#fs_fs_watch_filename_options_listener) with `recursive: true` option is only available in Mac and Windows.  For non Mac and Windows machines, git operations will be automatically refreshed but file changes may require manual refreshes as `fs.watch()` is unable to detect changes within nested directory hierarchy.

Text Editor Integrations
-------------------

* [atom-ungit](https://github.com/codingtwinky/atom-ungit) for [Atom.io](https://atom.io/) by [@codingtwinky](https://github.com/codingtwinky)

![atom-ungit Screenshot](https://raw.githubusercontent.com/codingtwinky/atom-ungit/master/screenshot.png)

* [brackets-ungit](https://github.com/Hirse/brackets-ungit) for [Brackets.io](http://brackets.io/) by [@hirse](https://github.com/Hirse)

![atom-brackets Screenshot](https://raw.githubusercontent.com/Hirse/brackets-ungit/master/images/viewer.png)

* [Codiad-OpenUngit](https://github.com/viharm/Codiad-OpenUngit) for [Codiad](http://codiad.com/) by [@viharm](https://github.com/viharm)

![Codiad-OpenUngit screenshot](https://cloud.githubusercontent.com/assets/2663937/21566609/6d107410-ce9c-11e6-91e1-2d8a1607b718.png)

* [vscode-ungit-tab](https://github.com/RomanValihura/vscode-ungit-tab) for [Visual Studio Code](https://code.visualstudio.com/) by [@RomanValihura](https://github.com/RomanValihura)
 
![VSCode-UngitTab screenshot](https://raw.githubusercontent.com/RomanValihura/vscode-ungit-tab/master/samples/ungit-vs.gif)


Developing
----------

See [CONTRIBUTING.md](CONTRIBUTING.md).

Maintainers
-----------
* [FredrikNoren](https://github.com/FredrikNoren)
* [codingtwinky](https://github.com/codingtwinky)

Known issues
------------

* If you're running MacOSX Mavericks and Ungit crashes after a few seconds; try updating npm and node. See [#259](https://github.com/FredrikNoren/ungit/issues/259) and [#249](https://github.com/FredrikNoren/ungit/issues/249) for details.
* Ubuntu users may have trouble installing because the node executable is named differently on Ubuntu, see [#401](https://github.com/FredrikNoren/ungit/issues/401) for details.
* Debian Wheezy's supported git and nodejs packages are too old, therefore download newest [git](https://github.com/git/git/releases) and [nodejs](https://nodejs.org/download/) tarballs and [build from source](http://www.control-escape.com/linux/lx-swinstall-tar.html).
* Adblocker may block Ungit! Some ad blockers, such as [Adblock plus](https://adblockplus.org) and [uBlock](https://www.ublock.org/), don't like localhost api calls and assume that it is a cross domain attack.  Please whitelist `{localhost|127.0.0.1|$UngitURL}:{ungit port number}`. [#887](https://github.com/FredrikNoren/ungit/issues/887) [#892](https://github.com/FredrikNoren/ungit/issues/892)

Changelog
---------
See [CHANGELOG.md](CHANGELOG.md).

License (MIT)
-------------

Copyright (C) 2013-2017 Fredrik Norén

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[![Dependency Status](https://david-dm.org/FredrikNoren/ungit.svg)](https://david-dm.org/FredrikNoren/ungit)
[![devDependency Status](https://david-dm.org/FredrikNoren/ungit/dev-status.svg)](https://david-dm.org/FredrikNoren/ungit#info=devDependencies)
