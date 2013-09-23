var fs = require('fs');
var child_process = require('child_process');
var path = require('path');

var version = exports;

version.currentVersion;

version.getVersion = function(callback) {
	if (version.currentVersion) callback(null, version.currentVersion);
	version.getPackageJsonVersion(function(err, packageJsonVersion) {
		if (err) return callback(err);
		if (fs.existsSync(path.join(__dirname, '..', '.git'))){
			child_process.exec('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') }, function(err, revision) {
				revision.replace('\n', ' ');
				revision = revision.trim();

				version.currentVersion = 'dev-' + packageJsonVersion + '-' + revision;
				callback(null, version.currentVersion);
			});
		} else {
			version.currentVersion = packageJsonVersion;
			callback(null, version.currentVersion);
		}
	});
}

version.getPackageJsonVersion = function(callback) {
	callback(null, require('../package.json').version);
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