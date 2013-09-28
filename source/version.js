var fs = require('fs');
var child_process = require('child_process');
var path = require('path');
var cache = require('./utils/cache');

var version = exports;

version.getVersion = cache(function(callback) {
	version.getPackageJsonVersion(function(err, packageJsonVersion) {
		if (err) return callback(err);
		if (fs.existsSync(path.join(__dirname, '..', '.git'))){
			child_process.exec('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') }, function(err, revision) {
				revision.replace('\n', ' ');
				revision = revision.trim();

				var ver = 'dev-' + packageJsonVersion + '-' + revision;
				callback(null, ver);
			});
		} else {
			callback(null, packageJsonVersion);
		}
	});
});

version.getPackageJsonVersion = function(callback) {
	callback(null, require('../package.json').version);
};

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