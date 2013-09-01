var fs = require('fs');
var child_process = require('child_process');
var path = require('path');

var cachedVersion;

var version = exports;

version.getVersion = function(callback) {
	if (cachedVersion) callback(cachedVersion);
	version.getPackageJsonVersion(function(err, packageJsonVersion) {
		if (err) return callback(err);
		fs.exists(path.join(__dirname, '..', '.git'), function(gitExists) {
			if (gitExists) {
				child_process.exec('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') }, function(err, revision) {
					revision.replace('\n', ' ');
					revision = revision.trim();

					cachedVersion = 'dev-' + packageJsonVersion + '-' + revision;
					callback(null, cachedVersion);
				});
			} else {
				cachedVersion = packageJsonVersion;
				callback(null, cachedVersion);
			}
		});
	});
}

version.getPackageJsonVersion = function(callback) {
	fs.readFile(path.join(__dirname, '..', 'package.json'), { encoding: 'utf8' }, function(err, packageJson) {
		if (err) return callback(err);
		var p = JSON.parse(packageJson.toString());
		callback(null, p.version);
	});
}

var npm;
version.getLatestVersion = function(callback) {
	if (!npm) npm = require('npm');
	var packageName = 'ungit';
	npm.load(function() {
		npm.commands.show([packageName, 'versions'], true, function(err, data) {
			if(err) return callback(err);
			var versions = data[Object.keys(data)[0]].versions;
			callback(null, versions[versions.length - 1]);
		});
	});
}