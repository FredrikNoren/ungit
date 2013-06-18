ungit
======

The easiest way to use git. On any platform. Anywhere.

 * Clean and intuitive UI that makes it easy to _understand_ git.
 * Runs on any platform that node.js & git supports.
 * Web-based, meaning you can run it on your cloud/pure shell machine and use the ui from your browser (just browse to http://your-cloud-machine.com:8448).
 * Works well with GitHub.
 * Gerrit integration (view, checkout and push changes form/to gerrit).

Installing
----------
Requires [node.js](http://nodejs.org) and [git](http://git-scm.com/).

	npm install -g ungit

Using
-----
Anywhere you want to start, just type:

	ungit

This will launch the server and open up a browser with the ui.

Configure
---------
Put a configuration file called .ungitrc in your home directory (`/home/USERNAME` on *nix, `C:/Users/USERNAME/` on windows). Can be in either json or ini format. See source/config.js for available options.