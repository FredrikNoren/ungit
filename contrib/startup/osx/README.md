Startup Script for Mac OS/X
=============================

Installation
-----------------------------
0. Install ungit as described in README.md at root.
1. Make links to both node and ungit:

<code>
$ sudo ln -s `which node` /usr/bin
$ sudo ln -s `which ungit` /usr/bin
</code>

2. Add new launchctl script to /Library/LaunchDaemons:

<code>
$ sudo cp com.fredriknoren.ungit.plist /Library/LaunchDaemons
</code>

3. Start using launchctl:
<code>
$ sudo launchctl load /Library/LaunchDaemons/com.fredriknoren.ungit.plist
</code>

Debugging
-----------------------------
If you encounter troubles with the script starting, try looking in the log
file, located (by default) at /var/log/ungit.log.
