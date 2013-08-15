var fs = require('fs');
var child_process = require('child_process');
var npm = require('npm');

var cachedVersion;

var version = exports;

version.getVersion = function(callback) {
	if (cachedVersion) callback(cachedVersion);
	version.getPackageJsonVersion(function(packageJsonVersion) {
		if (fs.existsSync(__dirname + '/../.git')) {
			child_process.exec('git rev-parse --short HEAD', { cwd: __dirname + '/../' }, function(err, revision) {
				revision.replace('\n', ' ');
				revision = revision.trim();

				cachedVersion = 'dev-' + packageJsonVersion + '-' + revision;
				callback(cachedVersion);
			});
		} else {
			cachedVersion = packageJsonVersion;
			callback(cachedVersion);
		}
	});
}

version.getPackageJsonVersion = function(callback) {
	var packageJson = fs.readFileSync(__dirname + '/../package.json');
	packageJson = JSON.parse(packageJson);
	callback(packageJson.version);
}

version.getLatestVersion = function(callback) {
	var packageName = 'ungit';
	npm.load(function() {
		npm.commands.show([packageName, 'versions'], true, function(err, data) {
			if(err) return callback(err);
			var versions = data[Object.keys(data)[0]].versions;
			callback(null, versions[versions.length - 1]);
		});
	});
}