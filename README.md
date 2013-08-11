ungit
======

The easiest way to use git. On any platform. Anywhere.

 * Clean and intuitive UI that makes it easy to _understand_ git.
 * Runs on any platform that node.js & git supports.
 * Web-based, meaning you can run it on your cloud/pure shell machine and use the ui from your browser (just browse to http://your-cloud-machine.com:8448).
 * Works well with GitHub.
 * Gerrit integration (view, checkout and push changes from/to gerrit).

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

License (MIT)
-------------

Copyright (C) 2013 Fredrik Norén

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.