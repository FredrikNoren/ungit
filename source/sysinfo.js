var fs = require('fs');
var child_process = require('child_process');
var path = require('path');
var cache = require('./utils/cache');
var getmac = require('getmac');
var md5 = require('blueimp-md5').md5;

var sysinfo = exports;

sysinfo.getUngitVersion = cache(function(callback) {
	sysinfo.getUngitPackageJsonVersion(function(err, packageJsonVersion) {
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

sysinfo.getUngitPackageJsonVersion = function(callback) {
	callback(null, require('../package.json').version);
};

var npm;
sysinfo.getUngitLatestVersion = function(callback) {
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

sysinfo.getUserHash = function(callback) {
	getmac.getMac(function(err, addr) {
		callback(err, md5(addr));
	});
}